"use server";

import { revalidatePath } from "next/cache";

import { captureError } from "@/lib/monitoring";
import { getServerWorkflowRepository } from "@/lib/workflows/repository.server";
import {
  pickPendingCheckpoints,
  type PendingCheckpoint,
} from "@/lib/workflows/aggregate";
import type {
  WorkflowGate,
  WorkflowInstance,
  WorkflowTask,
  WorkflowTaskCreateInput,
  WorkflowTemplate,
  WorkflowTrigger,
} from "@/lib/workflows/types";

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
  const trimmedTaskId = taskId.trim();

  // Atomic state transition: a *single* conditional UPDATE … WHERE id =
  // ? AND checkpoint = TRUE AND status = 'pending_approval'. RLS gates
  // *who* may write to the row; it does not encode workflow semantics,
  // so without this server-side gate a crafted client payload could
  // flip any reachable task — including non-checkpoints, or checkpoints
  // already resolved — into `complete` / `blocked` and emit a
  // misleading domain event. The previous getTask-then-updateTask
  // shape was correct in principle but racy: between the SELECT and
  // the UPDATE another writer could change the row, so we'd happily
  // resolve a checkpoint that had already been resolved (or worse,
  // transition a row that is no longer a checkpoint). Pushing both
  // predicates into the UPDATE closes that window — when no row is
  // returned, nothing was written, and we refuse without calling
  // `addEvent` so the database state and event feed stay truthful.
  const nextStatus = resolution === "approved" ? "complete" : "blocked";
  const task = await repo.transitionPendingCheckpoint(trimmedTaskId, nextStatus);
  if (!task) {
    throw new Error(
      "resolveCheckpointAction: task is missing, not a checkpoint, or no longer pending_approval",
    );
  }

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

/**
 * Approve a checkpoint task from the Task Drawer.
 *
 * Semantically different from `resolveCheckpointAction` (Overview card):
 * the drawer approval sets the task to `active` so the agent continues
 * running, whereas the Overview card's approve sets it to `complete` (task done).
 * The conditional update (`status = 'pending_approval'`) is enforced server-side
 * via plain `updateTask` here — the drawer provides the human-visible context
 * (audit trail, breadcrumb) that the Overview shortcut deliberately omits.
 */
export async function approveDrawerCheckpointAction(
  taskId: string,
): Promise<{ task: WorkflowTask }> {
  if (typeof taskId !== "string" || !taskId.trim()) {
    throw new Error("approveDrawerCheckpointAction: taskId is required");
  }

  const repo = await getServerWorkflowRepository();
  const trimmedId = taskId.trim();

  const current = await repo.getTask(trimmedId);
  if (!current) {
    throw new Error("approveDrawerCheckpointAction: task not found");
  }
  if (!current.checkpoint || current.status !== "pending_approval") {
    throw new Error(
      "approveDrawerCheckpointAction: task is not a pending checkpoint",
    );
  }

  const task = await repo.updateTask(trimmedId, { status: "active" });

  try {
    await repo.addEvent(trimmedId, {
      name: "workflow.checkpoint_approved",
      description: `Approved checkpoint: ${task.title}`,
      payload: { task_id: task.id, instance_id: task.instanceId },
    });
  } catch (eventError) {
    captureError(eventError, {
      feature: "workflows.drawer_approve",
      action: "addEvent",
      extra: { task_id: task.id, instance_id: task.instanceId },
    });
  }

  revalidatePath("/", "layout");
  return { task };
}

/**
 * Reject a checkpoint task from the Task Drawer.
 *
 * The task status remains `pending_approval` — the human must take manual
 * action outside the system. Only a domain event is written so the audit
 * trail reflects the rejection decision.
 */
export async function rejectDrawerCheckpointAction(
  taskId: string,
): Promise<void> {
  if (typeof taskId !== "string" || !taskId.trim()) {
    throw new Error("rejectDrawerCheckpointAction: taskId is required");
  }

  const repo = await getServerWorkflowRepository();
  const trimmedId = taskId.trim();

  const task = await repo.getTask(trimmedId);
  if (!task) {
    throw new Error("rejectDrawerCheckpointAction: task not found");
  }
  if (!task.checkpoint || task.status !== "pending_approval") {
    throw new Error(
      "rejectDrawerCheckpointAction: task is not a pending checkpoint",
    );
  }

  try {
    await repo.addEvent(trimmedId, {
      name: "workflow.checkpoint_rejected",
      description: `Rejected checkpoint: ${task.title}`,
      payload: { task_id: task.id, instance_id: task.instanceId },
    });
  } catch (eventError) {
    captureError(eventError, {
      feature: "workflows.drawer_reject",
      action: "addEvent",
      extra: { task_id: task.id, instance_id: task.instanceId },
    });
  }

  revalidatePath("/", "layout");
}

/**
 * Persist trigger and gate lists for a task.
 * Called by TriggerGateEditor after each inline add/remove.
 */
export async function updateTaskTriggerGatesAction(
  taskId: string,
  triggers: WorkflowTrigger[],
  gates: WorkflowGate[],
): Promise<{ task: WorkflowTask }> {
  if (typeof taskId !== "string" || !taskId.trim()) {
    throw new Error("updateTaskTriggerGatesAction: taskId is required");
  }

  const repo = await getServerWorkflowRepository();
  const trimmedId = taskId.trim();

  const task = await repo.updateTask(trimmedId, { triggers, gates });

  try {
    await repo.addEvent(trimmedId, {
      name: "workflow.task_updated",
      description: `Updated triggers/gates for: ${task.title}`,
      payload: { task_id: task.id, instance_id: task.instanceId },
    });
  } catch (eventError) {
    captureError(eventError, {
      feature: "workflows.trigger_gate_update",
      action: "addEvent",
      extra: { task_id: task.id, instance_id: task.instanceId },
    });
  }

  revalidatePath("/", "layout");
  return { task };
}

const MAX_TASK_TITLE_LENGTH = 120;
const MAX_TASK_DESCRIPTION_LENGTH = 240;
const MAX_PLAYBOOK_LENGTH = 120;

function normalizeTaskField(value: string, label: string, maxLength: number): string {
  if (typeof value !== "string") {
    throw new Error(`${label} must be a string`);
  }
  return value.trim().slice(0, maxLength);
}

export interface CreateTaskResult {
  task: WorkflowTask;
}

export interface UpdateTaskDetailsInput {
  taskId: string;
  title: string;
  description?: string;
  agent?: string | null;
  skill?: string | null;
  playbook?: string | null;
}

export async function createTaskAction(
  input: WorkflowTaskCreateInput,
): Promise<CreateTaskResult> {
  const instanceId = normalizeTaskField(input.instanceId, "instanceId", 80);
  const roleId = normalizeTaskField(input.roleId, "roleId", 80);
  const stageId = normalizeTaskField(input.stageId, "stageId", 80);
  const title = normalizeTaskField(input.title, "title", MAX_TASK_TITLE_LENGTH);
  const description = normalizeTaskField(
    input.description ?? "",
    "description",
    MAX_TASK_DESCRIPTION_LENGTH,
  );
  const playbook = normalizeTaskField(
    input.playbook ?? "",
    "playbook",
    MAX_PLAYBOOK_LENGTH,
  );

  if (!instanceId || !roleId || !stageId || !title) {
    throw new Error(
      "createTaskAction: instanceId, roleId, stageId, and title are required",
    );
  }

  const repo = await getServerWorkflowRepository();
  const task = await repo.createTask({
    ...input,
    instanceId,
    roleId,
    stageId,
    title,
    description,
    playbook: playbook || null,
  });

  try {
    await repo.addEvent(task.id, {
      name: "workflow.task_created",
      description: `Created task: ${task.title}`,
      payload: {
        task_id: task.id,
        instance_id: task.instanceId,
        role_id: task.roleId,
        stage_id: task.stageId,
      },
    });
  } catch (eventError) {
    captureError(eventError, {
      feature: "workflows.create_task",
      action: "addEvent",
      extra: { task_id: task.id, instance_id: task.instanceId },
    });
  }

  revalidatePath("/", "layout");
  return { task };
}

export async function updateTaskDetailsAction(
  input: UpdateTaskDetailsInput,
): Promise<{ task: WorkflowTask }> {
  const taskId = normalizeTaskField(input.taskId, "taskId", 80);
  const title = normalizeTaskField(input.title, "title", MAX_TASK_TITLE_LENGTH);
  const description = normalizeTaskField(
    input.description ?? "",
    "description",
    MAX_TASK_DESCRIPTION_LENGTH,
  );
  const playbook = normalizeTaskField(
    input.playbook ?? "",
    "playbook",
    MAX_PLAYBOOK_LENGTH,
  );

  if (!taskId || !title) {
    throw new Error("updateTaskDetailsAction: taskId and title are required");
  }

  const repo = await getServerWorkflowRepository();
  const task = await repo.updateTask(taskId, {
    title,
    description,
    agent: input.agent ?? null,
    skill: input.skill ?? null,
    playbook: playbook || null,
  });

  try {
    await repo.addEvent(task.id, {
      name: "workflow.task_updated",
      description: `Updated task: ${task.title}`,
      payload: {
        task_id: task.id,
        instance_id: task.instanceId,
      },
    });
  } catch (eventError) {
    captureError(eventError, {
      feature: "workflows.update_task_details",
      action: "addEvent",
      extra: { task_id: task.id, instance_id: task.instanceId },
    });
  }

  revalidatePath("/", "layout");
  return { task };
}

export interface MoveTaskResult {
  task: WorkflowTask;
}

export async function moveTaskAction(
  taskId: string,
  roleId: string,
  stageId: string,
): Promise<MoveTaskResult> {
  const trimmedTaskId = normalizeTaskField(taskId, "taskId", 80);
  const trimmedRoleId = normalizeTaskField(roleId, "roleId", 80);
  const trimmedStageId = normalizeTaskField(stageId, "stageId", 80);

  if (!trimmedTaskId || !trimmedRoleId || !trimmedStageId) {
    throw new Error("moveTaskAction: taskId, roleId, and stageId are required");
  }

  const repo = await getServerWorkflowRepository();
  const current = await repo.getTask(trimmedTaskId);
  if (!current) {
    throw new Error("moveTaskAction: task not found");
  }

  const task =
    current.roleId === trimmedRoleId && current.stageId === trimmedStageId
      ? current
      : await repo.updateTask(trimmedTaskId, {
          roleId: trimmedRoleId,
          stageId: trimmedStageId,
        });

  if (task !== current) {
    try {
      await repo.addEvent(task.id, {
        name: "workflow.task_moved",
        description: `Moved task: ${task.title}`,
        payload: {
          task_id: task.id,
          instance_id: task.instanceId,
          from_role_id: current.roleId,
          from_stage_id: current.stageId,
          to_role_id: task.roleId,
          to_stage_id: task.stageId,
        },
      });
    } catch (eventError) {
      captureError(eventError, {
        feature: "workflows.move_task",
        action: "addEvent",
        extra: { task_id: task.id, instance_id: task.instanceId },
      });
    }
  }

  revalidatePath("/", "layout");
  return { task };
}

export async function startTaskAction(
  taskId: string,
): Promise<{ task: WorkflowTask }> {
  const trimmedId = normalizeTaskField(taskId, "taskId", 80);
  if (!trimmedId) throw new Error("startTaskAction: taskId is required");

  const repo = await getServerWorkflowRepository();
  const task = await repo.updateTaskIfStatus(trimmedId, "not_started", {
    status: "active",
  });
  if (!task) {
    const current = await repo.getTask(trimmedId);
    if (!current) throw new Error("startTaskAction: task not found");
    throw new Error("startTaskAction: task is not in not_started state");
  }

  try {
    await repo.addEvent(trimmedId, {
      name: "workflow.task_started",
      description: `Started task: ${task.title}`,
      payload: { task_id: task.id, instance_id: task.instanceId },
    });
  } catch (eventError) {
    captureError(eventError, {
      feature: "workflows.start_task",
      action: "addEvent",
      extra: { task_id: task.id, instance_id: task.instanceId },
    });
  }

  revalidatePath("/", "layout");
  return { task };
}

/**
 * Stop an in-flight task run: persists `status: "blocked"` (failed in UI)
 * and records `workflow.run_cancelled`. Only `active` tasks accept this path.
 */
export async function cancelRunningTaskAction(
  taskId: string,
): Promise<{ task: WorkflowTask }> {
  const trimmedId = normalizeTaskField(taskId, "taskId", 80);
  if (!trimmedId) {
    throw new Error("cancelRunningTaskAction: taskId is required");
  }

  const repo = await getServerWorkflowRepository();
  const task = await repo.updateTaskIfStatus(trimmedId, "active", {
    status: "blocked",
  });
  if (!task) {
    const current = await repo.getTask(trimmedId);
    if (!current) {
      throw new Error("cancelRunningTaskAction: task not found");
    }
    throw new Error("cancelRunningTaskAction: task is not active");
  }

  try {
    await repo.addEvent(trimmedId, {
      name: "workflow.run_cancelled",
      description: `Failed run: ${task.title}`,
      payload: { task_id: task.id, instance_id: task.instanceId },
    });
  } catch (eventError) {
    captureError(eventError, {
      feature: "workflows.cancel_run",
      action: "addEvent",
      extra: { task_id: task.id, instance_id: task.instanceId },
    });
  }

  revalidatePath("/", "layout");
  return { task };
}

/**
 * Resume a failed playbook run: `blocked` → `active`.
 * Used when the user chooses Retry from the Task Drawer playbook control.
 */
export async function retryBlockedTaskAction(
  taskId: string,
): Promise<{ task: WorkflowTask }> {
  const trimmedId = normalizeTaskField(taskId, "taskId", 80);
  if (!trimmedId) {
    throw new Error("retryBlockedTaskAction: taskId is required");
  }

  const repo = await getServerWorkflowRepository();
  const task = await repo.updateTaskIfStatus(trimmedId, "blocked", {
    status: "active",
  });
  if (!task) {
    const current = await repo.getTask(trimmedId);
    if (!current) {
      throw new Error("retryBlockedTaskAction: task not found");
    }
    throw new Error("retryBlockedTaskAction: task is not blocked");
  }

  try {
    await repo.addEvent(trimmedId, {
      name: "workflow.run_retried",
      description: `Retried run: ${task.title}`,
      payload: { task_id: task.id, instance_id: task.instanceId },
    });
  } catch (eventError) {
    captureError(eventError, {
      feature: "workflows.retry_run",
      action: "addEvent",
      extra: { task_id: task.id, instance_id: task.instanceId },
    });
  }

  revalidatePath("/", "layout");
  return { task };
}

/**
 * Fetch pending checkpoints for the My Tasks panel.
 * Called client-side when the panel opens so it always shows fresh data.
 */
export async function fetchPendingCheckpointsAction(): Promise<PendingCheckpoint[]> {
  try {
    const repo = await getServerWorkflowRepository();
    const [templates, instances, tasks] = await Promise.all([
      repo.getTemplates(),
      repo.listInstances(),
      repo.listAllTasks(),
    ]);
    return pickPendingCheckpoints({ templates, instances, tasks, events: [] });
  } catch (error) {
    captureError(error, {
      feature: "workflows.fetch_pending_checkpoints",
      action: "list_pending",
    });
    throw error;
  }
}

export async function deleteTaskAction(taskId: string): Promise<void> {
  const trimmedTaskId = normalizeTaskField(taskId, "taskId", 80);
  if (!trimmedTaskId) {
    throw new Error("deleteTaskAction: taskId is required");
  }

  const repo = await getServerWorkflowRepository();
  const task = await repo.getTask(trimmedTaskId);
  if (!task) {
    throw new Error("deleteTaskAction: task not found");
  }

  await repo.deleteTask(trimmedTaskId);

  try {
    await repo.addInstanceEvent(task.instanceId, {
      taskId: null,
      name: "workflow.task_deleted",
      description: `Deleted task: ${task.title}`,
      payload: {
        task_id: task.id,
        instance_id: task.instanceId,
        role_id: task.roleId,
        stage_id: task.stageId,
      },
    });
  } catch (eventError) {
    captureError(eventError, {
      feature: "workflows.delete_task",
      action: "addInstanceEvent",
      extra: { task_id: task.id, instance_id: task.instanceId },
    });
  }

  revalidatePath("/", "layout");
}

function trimTemplateLabel(value: string): string {
  return value.trim().slice(0, MAX_LABEL_LENGTH);
}

function normalizeTemplateStages(
  stages: WorkflowTemplate["stages"],
): WorkflowTemplate["stages"] {
  return stages
    .map((stage) => ({
      id: normalizeTaskField(stage.id, "stage.id", 80),
      label: trimTemplateLabel(stage.label),
      sub: trimTemplateLabel(stage.sub ?? ""),
    }))
    .filter((stage) => stage.id && stage.label);
}

function normalizeTemplateRoles(
  roles: WorkflowTemplate["roles"],
): WorkflowTemplate["roles"] {
  return roles
    .map((role) => ({
      id: normalizeTaskField(role.id, "role.id", 80),
      label: trimTemplateLabel(role.label),
      owner: trimTemplateLabel(role.owner ?? ""),
      color: role.color?.trim() || undefined,
    }))
    .filter((role) => role.id && role.label);
}

function normalizeTemplateTaskTemplates(
  taskTemplates: WorkflowTemplate["taskTemplates"],
): WorkflowTemplate["taskTemplates"] {
  return taskTemplates
    .map((task) => ({
      ...task,
      id: normalizeTaskField(task.id ?? "", "taskTemplate.id", 120),
      role: normalizeTaskField(task.role, "taskTemplate.role", 80),
      stage: normalizeTaskField(task.stage, "taskTemplate.stage", 80),
      title: trimTemplateLabel(task.title),
      desc: trimTemplateLabel(task.desc ?? ""),
      agent: trimTemplateLabel(task.agent ?? ""),
      skill: trimTemplateLabel(task.skill ?? ""),
      playbook: trimTemplateLabel(task.playbook ?? ""),
      triggers: task.triggers ?? [],
      gates: task.gates ?? [],
      checkpoint: Boolean(task.checkpoint),
    }))
    .filter((task) => task.id && task.role && task.stage && task.title);
}

export async function updateTemplateAction(
  templateId: string,
  template: WorkflowTemplate,
): Promise<{ template: WorkflowTemplate }> {
  const trimmedTemplateId = normalizeTaskField(templateId, "templateId", 120);
  if (!trimmedTemplateId) {
    throw new Error("updateTemplateAction: templateId is required");
  }
  if (!template.label.trim()) {
    throw new Error("updateTemplateAction: template label is required");
  }

  const repo = await getServerWorkflowRepository();
  const updatedTemplate = await repo.updateTemplate(trimmedTemplateId, {
    label: trimTemplateLabel(template.label),
    stages: normalizeTemplateStages(template.stages),
    roles: normalizeTemplateRoles(template.roles),
    taskTemplates: normalizeTemplateTaskTemplates(template.taskTemplates),
  });

  revalidatePath("/", "layout");
  revalidatePath(`/workflows/templates/${trimmedTemplateId}/edit`);

  return { template: updatedTemplate };
}
