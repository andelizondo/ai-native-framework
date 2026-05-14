import type {
  TaskIOSummary,
  WorkflowSkill,
  WorkflowStage,
  WorkflowTask,
} from "@/lib/workflows/types";

/**
 * Per-edge classification consumed by the wiring overlay to decide which
 * paths are emphasized, ghosted, or hidden. Names map to UX intent rather
 * than raw task status so the overlay never has to re-derive the rule.
 */
export type EdgeFlowState =
  | "next"
  | "current"
  | "producing"
  | "settled"
  | "dormant";

const ACTIVE_STATUSES = new Set<WorkflowTask["status"]>([
  "in_progress",
  "running",
]);
const PENDING_STATUSES = new Set<WorkflowTask["status"]>([
  "not_started",
  "waiting",
]);

/**
 * "Active" = work happening now (in_progress/running) OR work the user could
 * pick up next (a pending task whose linked inputs are all met). Drives the
 * default-collapse seeding and the wire classification.
 */
export function isTaskActive(task: WorkflowTask, io?: TaskIOSummary): boolean {
  if (ACTIVE_STATUSES.has(task.status)) return true;
  if (PENDING_STATUSES.has(task.status)) {
    return Boolean(io) && !io!.hasUnmetLinkedInput;
  }
  return false;
}

export function isTaskSettled(task: WorkflowTask): boolean {
  return task.status === "complete";
}

function buildIoIndex(io: TaskIOSummary[]): Map<string, TaskIOSummary> {
  return new Map(io.map((s) => [s.taskId, s]));
}

export function activeStageIds(
  tasks: WorkflowTask[],
  io: TaskIOSummary[],
): Set<string> {
  const idx = buildIoIndex(io);
  const out = new Set<string>();
  for (const t of tasks) {
    if (isTaskActive(t, idx.get(t.id))) out.add(t.stageId);
  }
  return out;
}

export function activeSkillIds(
  tasks: WorkflowTask[],
  io: TaskIOSummary[],
): Set<string> {
  const idx = buildIoIndex(io);
  const out = new Set<string>();
  for (const t of tasks) {
    if (isTaskActive(t, idx.get(t.id))) out.add(t.skillId);
  }
  return out;
}

export function classifyEdge(
  from: WorkflowTask,
  to: WorkflowTask,
  toIO?: TaskIOSummary,
): EdgeFlowState {
  const fromComplete = from.status === "complete";
  const toComplete = to.status === "complete";
  const fromActive = ACTIVE_STATUSES.has(from.status);
  const toActive = ACTIVE_STATUSES.has(to.status);
  if (fromComplete && toComplete) return "settled";
  if (fromComplete && toActive) return "current";
  if (
    fromComplete &&
    PENDING_STATUSES.has(to.status) &&
    toIO &&
    !toIO.hasUnmetLinkedInput
  ) {
    return "next";
  }
  if (fromActive) return "producing";
  return "dormant";
}

/**
 * Seed the matrix's `collapsedStageIds` set on mount. Returns the set of
 * stages that should start collapsed.
 *   - any active work → collapse stages without active tasks
 *   - all complete → collapse everything (review mode is fully folded)
 *   - kickoff (nothing started) → collapse all but the first stage
 */
export function seedCollapsedStages(
  tasks: WorkflowTask[],
  io: TaskIOSummary[],
  stages: WorkflowStage[],
): Set<string> {
  const active = activeStageIds(tasks, io);
  if (active.size > 0) {
    return new Set(stages.filter((s) => !active.has(s.id)).map((s) => s.id));
  }
  if (tasks.length > 0 && tasks.every(isTaskSettled)) {
    return new Set(stages.map((s) => s.id));
  }
  if (stages.length <= 1) return new Set();
  return new Set(stages.slice(1).map((s) => s.id));
}

/**
 * Seed `collapsedSkillIds` on mount.
 *   - any active work → collapse skills without active tasks
 *   - all complete → collapse every skill (matches the fully-folded stages)
 *   - kickoff → leave skills expanded so the focused first stage isn't
 *     reduced to a single visible row
 */
export function seedCollapsedSkills(
  tasks: WorkflowTask[],
  io: TaskIOSummary[],
  skills: WorkflowSkill[],
): Set<string> {
  const active = activeSkillIds(tasks, io);
  if (active.size > 0) {
    return new Set(skills.filter((s) => !active.has(s.id)).map((s) => s.id));
  }
  if (tasks.length > 0 && tasks.every(isTaskSettled)) {
    return new Set(skills.map((s) => s.id));
  }
  return new Set();
}
