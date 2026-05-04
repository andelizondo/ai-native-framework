import type { WorkflowTaskStatus } from "@/lib/workflows/types";

export const TASK_STATUS_LABEL: Record<WorkflowTaskStatus, string> = {
  complete: "Complete",
  active: "In progress",
  pending_approval: "Pending approval",
  blocked: "Failed",
  not_started: "Not started",
};

export const TASK_STATUS_PILL_CLASS: Record<WorkflowTaskStatus, string> = {
  complete: "s-complete",
  active: "s-active",
  pending_approval: "s-pending",
  blocked: "s-blocked",
  not_started: "s-not_started",
};

export const TASK_STATUS_ORDER: readonly WorkflowTaskStatus[] = [
  "not_started",
  "active",
  "pending_approval",
  "complete",
  "blocked",
];

export const TASK_STATUS_VAR: Record<WorkflowTaskStatus, string> = {
  complete: "var(--pill-complete-d)",
  active: "var(--pill-active-d)",
  pending_approval: "var(--pill-pending-d)",
  blocked: "var(--pill-blocked-d)",
  not_started: "var(--pill-ns-d)",
};
