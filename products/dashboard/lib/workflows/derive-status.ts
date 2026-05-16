import type {
  TaskInputState,
  TaskOutput,
  WorkflowInput,
  WorkflowTaskStatus,
} from "@/lib/workflows/types";

export interface DeriveStatusArgs {
  /** The currently persisted status — anchors transitions that have no
   *  signal in inputs/outputs (e.g. `complete` is terminal, `in_progress`
   *  carries through if no override fires). */
  persisted: WorkflowTaskStatus;
  /** Non-null reason → `paused` wins (unless terminal `complete`). */
  pausedReason?: string | null;
  /** Per-task input state. The matching `inputs` definition is needed
   *  to know which inputs are `linked` (only those gate readiness). */
  inputs: TaskInputState[];
  inputDefs: WorkflowInput[];
  outputs: TaskOutput[];
  agentRun: { status: "running" | "completed" | "failed" } | null;
}

/**
 * Canonical status reconciler for the 7-state enum (AEL-60). Pure: given
 * the same arguments it returns the same status. Called by every server
 * action that mutates a task before persisting.
 *
 * Rule order (first match wins):
 *  1. persisted === 'complete' is terminal.
 *  2. Any output failed OR agent run failed → 'failed'.
 *  3. Outputs declared AND every output produced → 'complete'.
 *  4. pausedReason set → 'paused'.
 *  5. agentRun.status === 'running' → 'running'.
 *  6. persisted === 'in_progress' carries through.
 *  7. Any linked input not yet received → 'waiting'.
 *  8. Otherwise 'not_started'.
 */
export function deriveStatus(args: DeriveStatusArgs): WorkflowTaskStatus {
  const { persisted, pausedReason, inputs, inputDefs, outputs, agentRun } = args;

  if (persisted === "complete") return "complete";

  const anyOutputFailed = outputs.some((o) => o.status === "failed");
  if (anyOutputFailed || agentRun?.status === "failed") return "failed";

  if (outputs.length > 0 && outputs.every((o) => o.status === "produced")) {
    return "complete";
  }

  if (pausedReason && pausedReason.trim().length > 0) return "paused";

  if (agentRun?.status === "running") return "running";

  if (persisted === "in_progress") return "in_progress";

  const linkedDefIds = new Set(inputDefs.map((i) => i.id));
  if (linkedDefIds.size > 0) {
    const receivedById = new Map(inputs.map((i) => [i.inputId, i.received]));
    const allReceived = Array.from(linkedDefIds).every(
      (id) => receivedById.get(id) === true,
    );
    if (!allReceived) return "waiting";
  }

  return "not_started";
}
