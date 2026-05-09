import type { WorkflowTaskStatus } from "@/lib/workflows/types";

/**
 * 7-state design enum (PR 2 / AEL-60). Render code reads the persisted
 * status; `deriveStatus()` is the single source of truth for transitions.
 *
 * Pill class names map to existing CSS variables in `app/globals.css`:
 * `--pill-{state}-d` (dark/foreground) and `--pill-{state}-l` (light/bg).
 * Variables for the new states (`waiting`, `paused`, `in_progress`,
 * `running`, `failed`) are kept aligned with the old pill family so the
 * stylesheet does not need a parallel rewrite — `pending → paused`,
 * `active → in_progress`, `blocked → failed`. New `waiting` and `running`
 * fall back to the `pending` / `active` palettes respectively.
 */
export const TASK_STATUS_LABEL: Record<WorkflowTaskStatus, string> = {
  not_started: "Not started",
  waiting: "Waiting",
  paused: "Paused",
  in_progress: "In progress",
  running: "Running",
  complete: "Complete",
  failed: "Failed",
};

export const TASK_STATUS_PILL_CLASS: Record<WorkflowTaskStatus, string> = {
  not_started: "s-not_started",
  waiting: "s-waiting",
  paused: "s-paused",
  in_progress: "s-in_progress",
  running: "s-running",
  complete: "s-complete",
  failed: "s-failed",
};

export const TASK_STATUS_ORDER: readonly WorkflowTaskStatus[] = [
  "not_started",
  "waiting",
  "paused",
  "in_progress",
  "running",
  "complete",
  "failed",
];

export const TASK_STATUS_VAR: Record<WorkflowTaskStatus, string> = {
  not_started: "var(--pill-ns-d)",
  waiting: "var(--pill-pending-d)",
  paused: "var(--pill-pending-d)",
  in_progress: "var(--pill-active-d)",
  running: "var(--pill-active-d)",
  complete: "var(--pill-complete-d)",
  failed: "var(--pill-blocked-d)",
};
