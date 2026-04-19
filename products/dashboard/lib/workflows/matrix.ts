import type { WorkflowTask } from "./types";

/**
 * Pure helpers for the read-only Process Matrix.
 *
 * Source: `canStart` and `barClass` in
 * `/tmp/design-canvas/ai-native-dashboard/project/pc-components.jsx`
 * (lines 301-308 and 408-413). The prototype's `canStart` filtered by
 * `t.type==='task'` even though the prototype data uses
 * `type: 'after_task'` (see `Process Canvas v2/data.js` lines 110-188).
 * We treat both spellings as the canonical "this task waits on another
 * task in the same instance" trigger so the seed data and the
 * prototype's UX semantics line up.
 *
 * `taskRef` (preferred) carries the upstream task **title**; `taskId`
 * is supported as a defensive fallback because the prototype's data
 * sometimes uses ids instead of titles. Triggers without a usable
 * reference are ignored — they cannot block readiness without a target.
 */
const TASK_TRIGGER_TYPES = new Set(["task", "after_task"]);

/**
 * Bar state strings rendered by `.task-card.bar-*` (see `globals.css`).
 * Exporting the type keeps the component / test surface honest:
 * any new state must round-trip through this union.
 */
export type TaskBarState =
  | "bar-locked"
  | "bar-ready"
  | "bar-active"
  | "bar-pending"
  | "bar-complete"
  | "bar-blocked";

/**
 * Returns true when `task` has no remaining upstream task dependencies.
 *
 * - Tasks already past `not_started` are always considered "started";
 *   the readiness check only matters for the locked / ready transition
 *   the prototype renders as a bar opacity bump.
 * - Tasks with no task-typed triggers can always start (they're either
 *   manual, event-driven, or independent — none of those gate the bar).
 * - Tasks with task triggers can start only when *every* referenced
 *   upstream task in the same instance is `complete`.
 */
export function canStart(
  task: WorkflowTask,
  allTasks: readonly WorkflowTask[],
): boolean {
  if (task.status !== "not_started") return true;

  const upstream = (task.triggers ?? []).filter((t) =>
    TASK_TRIGGER_TYPES.has(t.type),
  );
  if (upstream.length === 0) return true;

  return upstream.every((trigger) => {
    const ref = trigger.taskRef ?? trigger.taskId;
    if (!ref) return true;
    const dep = allTasks.find(
      (candidate) => candidate.title === ref || candidate.id === ref,
    );
    return dep?.status === "complete";
  });
}

/**
 * Map a task to its `task-card` bar-state class.
 *
 * Mirrors the prototype's precedence (status wins; `canStart` only
 * decides the locked/ready split for `not_started`). Kept as a pure
 * function so the component stays a thin renderer and the unit tests
 * can pin down each branch.
 */
export function barClass(
  task: WorkflowTask,
  isReady: boolean,
): TaskBarState {
  switch (task.status) {
    case "complete":
      return "bar-complete";
    case "active":
      return "bar-active";
    case "pending_approval":
      return "bar-pending";
    case "blocked":
      return "bar-blocked";
    case "not_started":
    default:
      return isReady ? "bar-ready" : "bar-locked";
  }
}
