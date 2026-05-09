import type { WorkflowTask } from "./types";

/**
 * Pure helpers for the read-only Process Matrix.
 *
 * A task's readiness is now governed by its `inputs`: only `linked` inputs
 * gate the bar (manual / bypass inputs do not). A linked input resolves
 * by pointing at an upstream task (`upstreamTaskRef`) whose status is
 * `complete`. PR 2 (AEL-60) layers in upstream output resolution.
 */

/**
 * Bar state strings rendered by `.task-card.bar-*` (see `globals.css`).
 * `bar-glow` is the shared "demands attention" treatment used for both
 * `pending_approval` and `blocked` (UI "Failed"); the glow color is then
 * resolved from the task's status class (`s-pending`, `s-blocked`).
 */
export type TaskBarState =
  | "bar-locked"
  | "bar-ready"
  | "bar-active"
  | "bar-glow"
  | "bar-complete";

/**
 * Returns true when `task` has no remaining unresolved linked inputs.
 *
 * - Tasks already past `not_started` are always considered "started".
 * - A task with no linked inputs (or no inputs at all) can always start.
 * - A task with linked inputs can start only when every upstream task it
 *   references has status `complete`.
 */
export function canStart(
  task: WorkflowTask,
  allTasks: readonly WorkflowTask[],
): boolean {
  if (task.status !== "not_started") return true;

  const linked = (task.inputs ?? []).filter((input) => input.linkMode === "linked");
  if (linked.length === 0) return true;

  return linked.every((input) => {
    const ref = input.upstreamTaskRef;
    if (!ref) return true;
    const dep = allTasks.find(
      (candidate) => candidate.id === ref || candidate.playbookId === ref,
    );
    return dep?.status === "complete";
  });
}

/**
 * Map a task to its `task-card` bar-state class. Status wins; `canStart`
 * only decides the locked/ready split for `not_started`.
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
    case "blocked":
      return "bar-glow";
    case "not_started":
    default:
      return isReady ? "bar-ready" : "bar-locked";
  }
}
