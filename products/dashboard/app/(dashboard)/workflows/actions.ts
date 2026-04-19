"use server";

import { revalidatePath } from "next/cache";

import { captureError } from "@/lib/monitoring";
import { getServerWorkflowRepository } from "@/lib/workflows/repository.server";
import type { WorkflowInstance, WorkflowTask } from "@/lib/workflows/types";

/**
 * Server action invoked by the create-instance modal.
 *
 * Calls into the cookie-aware Supabase repository so RLS sees the signed-in
 * user (DEC-002), then `revalidatePath('/', 'layout')` so the next render
 * of the dashboard layout (and therefore the sidebar workflow tree fed by
 * `getServerWorkflowRepository().listInstances()`) picks up the new row.
 *
 * Returns the persisted instance so the modal can navigate to
 * `/workflows/{id}` without a second round-trip.
 *
 * Inputs are trimmed and length-clamped here so untrusted client input
 * cannot smuggle blank labels or pathological strings into the database.
 */

const MAX_LABEL_LENGTH = 120;

export interface CreateInstanceResult {
  instance: WorkflowInstance;
}

export async function createInstanceAction(
  templateId: string,
  rawLabel: string,
): Promise<CreateInstanceResult> {
  if (typeof templateId !== "string" || !templateId.trim()) {
    throw new Error("createInstanceAction: templateId is required");
  }
  if (typeof rawLabel !== "string") {
    throw new Error("createInstanceAction: label must be a string");
  }

  const label = rawLabel.trim().slice(0, MAX_LABEL_LENGTH);
  if (!label) {
    throw new Error("createInstanceAction: label cannot be empty");
  }

  const repo = await getServerWorkflowRepository();
  const detail = await repo.createInstance(templateId.trim(), label);

  revalidatePath("/", "layout");

  // Strip the heavy `tasks`/`events` arrays before returning to the client —
  // the modal only needs the persisted id + label to navigate.
  const { tasks: _tasks, events: _events, ...instance } = detail;
  return { instance };
}

/**
 * Inline checkpoint resolution from the Overview "My Tasks" card.
 *
 * PR-6 surfaces pending-approval tasks with Approve / Reject buttons so
 * the founder can clear the queue without opening the matrix. The full
 * Task Drawer (Details + Events + audit trail) lands in PR-8 (AEL-51);
 * this action is the minimum write path needed to make the buttons in
 * the Overview do real work and emit a domain event for downstream
 * analytics.
 *
 * Side effects:
 *   1. `updateTask` flips the task to `complete` (approve) or `blocked`
 *      (reject — keeps the task visible in the matrix so the agent can
 *      iterate; canonical "back to active" semantics will land with the
 *      drawer that lets the founder leave a note).
 *   2. `addEvent` writes a `workflow.checkpoint_approved|rejected`
 *      domain event so the Recent Events card and PostHog feeds reflect
 *      the change immediately.
 *   3. `revalidatePath('/', 'layout')` so the Overview rerenders with
 *      one fewer pending row and the new event at the top of the feed.
 */
export type CheckpointResolution = "approved" | "rejected";

export interface ResolveCheckpointResult {
  task: WorkflowTask;
}

export async function resolveCheckpointAction(
  taskId: string,
  resolution: CheckpointResolution,
): Promise<ResolveCheckpointResult> {
  if (typeof taskId !== "string" || !taskId.trim()) {
    throw new Error("resolveCheckpointAction: taskId is required");
  }
  if (resolution !== "approved" && resolution !== "rejected") {
    throw new Error(
      `resolveCheckpointAction: unknown resolution "${resolution}"`,
    );
  }

  const repo = await getServerWorkflowRepository();
  const nextStatus = resolution === "approved" ? "complete" : "blocked";
  const task = await repo.updateTask(taskId.trim(), { status: nextStatus });

  // The status mutation already committed. If the audit-event write fails
  // we MUST NOT swallow that silently — but we also can't let the throw
  // skip `revalidatePath`, or the Overview would keep showing the task
  // as pending while the database has already moved on. So: log the
  // event-write failure to Sentry, refresh the cache, then return the
  // updated task. The Recent Events card will be missing one entry until
  // the next write, but the task state in My Tasks / Process Health is
  // consistent with the database.
  try {
    await repo.addEvent(task.id, {
      name:
        resolution === "approved"
          ? "workflow.checkpoint_approved"
          : "workflow.checkpoint_rejected",
      description:
        resolution === "approved"
          ? `Approved checkpoint: ${task.title}`
          : `Rejected checkpoint: ${task.title}`,
      payload: {
        task_id: task.id,
        instance_id: task.instanceId,
        // resolved_by deliberately omitted from the action payload here —
        // the shell does not have the founder identifier in this context;
        // the catalog accepts the field as required only at the gateway
        // ingestion layer where the request is authenticated end-to-end.
      },
    });
  } catch (eventError) {
    captureError(eventError, {
      feature: "workflows.resolve_checkpoint",
      action: `addEvent.${resolution}`,
      extra: {
        task_id: task.id,
        instance_id: task.instanceId,
      },
    });
  }

  revalidatePath("/", "layout");

  return { task };
}
