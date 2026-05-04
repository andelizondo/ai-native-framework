import type {
  WorkflowEvent,
  WorkflowInstance,
  WorkflowTask,
  WorkflowTemplate,
} from "./types";

/**
 * Pure aggregation helpers that turn a workflow snapshot (templates +
 * instances + tasks + recent events) into the numbers the Overview
 * screen renders. Kept side-effect free and Supabase-agnostic so unit
 * tests can drive every counting/percentage edge case without spinning
 * up a database.
 *
 * Source design: `OverviewScreen` in
 * `/tmp/design-canvas/ai-native-dashboard/project/pc-components.jsx`
 * (lines 771-819) — the prototype counted live, hard-coded `CHECKPOINTS`
 * for pending approvals; we treat any task in `pending_approval` as a
 * pending decision (the `checkpoint` flag describes the *template*
 * intent of the slot, not whether the task is currently awaiting one).
 */

export interface OverviewSnapshot {
  templates: WorkflowTemplate[];
  instances: WorkflowInstance[];
  tasks: WorkflowTask[];
  events: WorkflowEvent[];
}

export interface OverviewStats {
  /** Number of instances whose status is anything other than `complete`. */
  activeInstances: number;
  /** Tasks awaiting a human decision (status === "pending_approval"). */
  pendingTasks: number;
  /** Tasks currently active (status === "active"). */
  activeTasks: number;
  /** Tasks that have reached the `complete` state. */
  completedTasks: number;
  /** Total tasks across every instance. */
  totalTasks: number;
  /**
   * Completion percent, rounded to the nearest integer.
   * Defined as 0 when there are no tasks to avoid NaN in the UI.
   */
  completionPct: number;
}

export interface TemplateHealth {
  template: WorkflowTemplate;
  instances: WorkflowInstance[];
  totalTasks: number;
  completedTasks: number;
  /** Per-template completion percent, rounded; 0 when no tasks exist. */
  completionPct: number;
}

/**
 * Round a 0-1 ratio to a 0-100 integer, treating empty denominators as 0.
 *
 * The Overview screen uses these numbers to drive both copy ("3 / 12 tasks")
 * and progress bars; a NaN slipping through here would render as `NaN%` and
 * break the bar fill — keeping the floor at 0 protects both surfaces.
 *
 * The result is also clamped to `[0, 100]` even when the inputs are finite:
 * upstream drift (e.g. `complete > total` due to a buggy filter, or a
 * negative `complete` from a partial deletion) would otherwise paint a
 * progress bar that overflows its track or shows a negative percentage.
 * Defense-in-depth here keeps every consumer from having to re-clamp.
 */
export function percentComplete(complete: number, total: number): number {
  if (!Number.isFinite(complete) || !Number.isFinite(total) || total <= 0) {
    return 0;
  }
  const raw = Math.round((complete / total) * 100);
  if (!Number.isFinite(raw)) return 0;
  return Math.max(0, Math.min(100, raw));
}

/**
 * Compute the four stat-card numbers + completion percent from a snapshot.
 *
 * Mirrors the prototype's stat-row math (`pc-components.jsx` line 793) with
 * one substantive shift: "active instances" excludes completed instances so
 * the stat tracks live work, not lifetime totals. A founder glancing at the
 * Overview should see what is currently in flight.
 */
export function computeOverviewStats(snapshot: OverviewSnapshot): OverviewStats {
  const tasks = snapshot.tasks;
  const completedTasks = tasks.filter((t) => t.status === "complete").length;
  const activeTasks = tasks.filter((t) => t.status === "active").length;
  const pendingTasks = tasks.filter((t) => t.status === "pending_approval").length;
  const activeInstances = snapshot.instances.filter(
    (i) => i.status !== "complete",
  ).length;

  return {
    activeInstances,
    pendingTasks,
    activeTasks,
    completedTasks,
    totalTasks: tasks.length,
    completionPct: percentComplete(completedTasks, tasks.length),
  };
}

/**
 * Group instances by template and roll up per-template completion so the
 * Process Health card can render a row per template.
 *
 * Templates are returned in their input order so callers control sort
 * (the repository orders by `label` ASC today). Templates with no
 * instances are still included — the prototype shows them with a 0%
 * bar so the grid stays predictable as a workspace grows.
 */
export function computeTemplateHealth(snapshot: OverviewSnapshot): TemplateHealth[] {
  const tasksByInstance = new Map<string, WorkflowTask[]>();
  for (const task of snapshot.tasks) {
    const bucket = tasksByInstance.get(task.instanceId) ?? [];
    bucket.push(task);
    tasksByInstance.set(task.instanceId, bucket);
  }

  // Index instances by template once instead of re-filtering the full
  // instance list per template inside `.map()`. The naive O(N*M) loop
  // becomes O(N+M) and the per-render cost stays flat as a workspace
  // grows past the early-stage handful of templates / instances.
  const instancesByTemplate = new Map<string, WorkflowInstance[]>();
  for (const instance of snapshot.instances) {
    const bucket = instancesByTemplate.get(instance.templateId) ?? [];
    bucket.push(instance);
    instancesByTemplate.set(instance.templateId, bucket);
  }

  return snapshot.templates.map((template) => {
    const instances = instancesByTemplate.get(template.id) ?? [];
    let completedTasks = 0;
    let totalTasks = 0;
    for (const instance of instances) {
      const tasks = tasksByInstance.get(instance.id) ?? [];
      totalTasks += tasks.length;
      completedTasks += tasks.filter((t) => t.status === "complete").length;
    }

    return {
      template,
      instances,
      totalTasks,
      completedTasks,
      completionPct: percentComplete(completedTasks, totalTasks),
    };
  });
}

/**
 * Pick the most recent N events from a snapshot. The repository already
 * orders events by `created_at` DESC, but callers may want to enforce
 * the slice length here so the UI never overflows even if a future
 * caller forgets the `.limit()` clause.
 */
export function pickRecentEvents(
  snapshot: OverviewSnapshot,
  limit: number,
): WorkflowEvent[] {
  if (limit <= 0) return [];
  return snapshot.events.slice(0, limit);
}

/**
 * Pending checkpoint tasks projected for the My Tasks card. Each entry
 * carries the parent instance + template so the UI can render the
 * "PROCESS · TASK · By <agent>" stack without a second lookup.
 */
export interface PendingCheckpoint {
  task: WorkflowTask;
  instance: WorkflowInstance;
  template: WorkflowTemplate | null;
}

export function pickPendingCheckpoints(snapshot: OverviewSnapshot): PendingCheckpoint[] {
  const instanceById = new Map(snapshot.instances.map((i) => [i.id, i]));
  const templateById = new Map(snapshot.templates.map((t) => [t.id, t]));

  return snapshot.tasks
    .filter((t) => t.status === "pending_approval")
    .map((task) => {
      const instance = instanceById.get(task.instanceId);
      if (!instance) return null;
      return {
        task,
        instance,
        template: templateById.get(instance.templateId) ?? null,
      };
    })
    .filter((entry): entry is PendingCheckpoint => entry !== null);
}

/**
 * Active task projected for the "Tasks in progress" card on the Overview.
 * Carries the parent instance + template so the card can render the
 * "PROCESS · INSTANCE" label and color without a second lookup, mirroring
 * the `PendingCheckpoint` shape used by `MyTasksCard`.
 */
export interface ActiveTask {
  task: WorkflowTask;
  instance: WorkflowInstance;
  template: WorkflowTemplate | null;
}

export function pickActiveTasks(snapshot: OverviewSnapshot): ActiveTask[] {
  const instanceById = new Map(snapshot.instances.map((i) => [i.id, i]));
  const templateById = new Map(snapshot.templates.map((t) => [t.id, t]));

  return snapshot.tasks
    .filter((t) => t.status === "active")
    .map((task) => {
      const instance = instanceById.get(task.instanceId);
      if (!instance) return null;
      return {
        task,
        instance,
        template: templateById.get(instance.templateId) ?? null,
      };
    })
    .filter((entry): entry is ActiveTask => entry !== null);
}
