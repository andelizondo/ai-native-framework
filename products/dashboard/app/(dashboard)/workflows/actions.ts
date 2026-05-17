"use server";

import { revalidatePath } from "next/cache";

import { captureError } from "@/lib/monitoring";
import { getServerWorkflowRepository } from "@/lib/workflows/repository.server";
import { WorkflowRepositoryError } from "@/lib/workflows/repository";
import {
  pickPendingCheckpoints,
  type PendingCheckpoint,
} from "@/lib/workflows/aggregate";
import type {
  DrawerData,
  InstanceTemplateDiff,
  OutputArtifact,
  PlaybookOutput,
  TaskInputState,
  TaskOutput,
  TemplateOutputGroup,
  TemplateSyncSelection,
  WorkflowInput,
  WorkflowInstance,
  WorkflowInstanceDetail,
  WorkflowTask,
  WorkflowTaskCreateInput,
  WorkflowTaskStatus,
  WorkflowTaskTemplate,
  WorkflowTemplate,
} from "@/lib/workflows/types";

const TASK_STATUS_VALUES: readonly WorkflowTaskStatus[] = [
  "not_started",
  "waiting",
  "paused",
  "in_progress",
  "running",
  "complete",
  "failed",
];

function isWorkflowTaskStatus(value: unknown): value is WorkflowTaskStatus {
  return typeof value === "string" && (TASK_STATUS_VALUES as readonly string[]).includes(value);
}

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

export async function renameInstanceAction(
  instanceId: string,
  rawLabel: string,
): Promise<{ instance: WorkflowInstance }> {
  const trimmedInstanceId = normalizeTaskField(instanceId, "instanceId", 80);
  const label = normalizeTaskField(rawLabel, "label", MAX_LABEL_LENGTH);
  if (!trimmedInstanceId || !label) {
    throw new Error("renameInstanceAction: instanceId and label are required");
  }

  const repo = await getServerWorkflowRepository();
  const instance = await repo.updateInstance(trimmedInstanceId, { label });

  revalidatePath("/", "layout");
  revalidatePath(`/workflows/${trimmedInstanceId}`);
  return { instance };
}

export async function deleteInstanceAction(instanceId: string): Promise<void> {
  const trimmedInstanceId = normalizeTaskField(instanceId, "instanceId", 80);
  if (!trimmedInstanceId) {
    throw new Error("deleteInstanceAction: instanceId is required");
  }

  const repo = await getServerWorkflowRepository();
  await repo.deleteInstance(trimmedInstanceId);

  revalidatePath("/", "layout");
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
  const nextStatus = resolution === "approved" ? "in_progress" : "failed";
  const task = await repo.transitionPendingCheckpoint(trimmedTaskId, nextStatus);
  if (!task) {
    throw new Error(
      "resolveCheckpointAction: task is missing, not a checkpoint, or not paused on a checkpoint",
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
          ? `Approved checkpoint: ${task.id}`
          : `Rejected checkpoint: ${task.id}`,
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
  if (
    !current.checkpoint ||
    current.status !== "paused" ||
    current.pausedReason !== "checkpoint"
  ) {
    throw new Error(
      "approveDrawerCheckpointAction: task is not a paused checkpoint",
    );
  }

  const task = await repo.resumeTask(trimmedId);

  try {
    await repo.addEvent(trimmedId, {
      name: "workflow.checkpoint_approved",
      description: `Approved checkpoint: ${task.id}`,
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
  if (
    !task.checkpoint ||
    task.status !== "paused" ||
    task.pausedReason !== "checkpoint"
  ) {
    throw new Error(
      "rejectDrawerCheckpointAction: task is not a paused checkpoint",
    );
  }

  try {
    await repo.addEvent(trimmedId, {
      name: "workflow.checkpoint_rejected",
      description: `Rejected checkpoint: ${task.id}`,
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
 * Persist the inputs list for a task. Called by the drawer's inputs
 * editor after each inline add/remove.
 */
export async function updateTaskInputsAction(
  taskId: string,
  inputs: WorkflowInput[],
): Promise<{ task: WorkflowTask }> {
  if (typeof taskId !== "string" || !taskId.trim()) {
    throw new Error("updateTaskInputsAction: taskId is required");
  }
  if (!Array.isArray(inputs)) {
    throw new Error("updateTaskInputsAction: inputs must be an array");
  }

  const repo = await getServerWorkflowRepository();
  const trimmedId = taskId.trim();

  const task = await repo.updateTask(trimmedId, { inputs });

  try {
    await repo.addEvent(trimmedId, {
      name: "workflow.task_updated",
      description: `Updated inputs for: ${task.id}`,
      payload: { task_id: task.id, instance_id: task.instanceId },
    });
  } catch (eventError) {
    captureError(eventError, {
      feature: "workflows.inputs_update",
      action: "addEvent",
      extra: { task_id: task.id, instance_id: task.instanceId },
    });
  }

  revalidatePath("/", "layout");
  return { task };
}

const MAX_NOTES_LENGTH = 240;
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
  playbookId?: string | null;
  notes?: string;
  owners?: string[];
  inputs?: WorkflowInput[];
  outputs?: PlaybookOutput[];
}

const MAX_OWNER_LABEL_LENGTH = 80;

function normalizeOwnerList(input: unknown): string[] | undefined {
  if (input === undefined) return undefined;
  if (!Array.isArray(input)) return [];
  return input
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .map((value) => value.trim().slice(0, MAX_OWNER_LABEL_LENGTH));
}

export async function createTaskAction(
  input: WorkflowTaskCreateInput,
): Promise<CreateTaskResult> {
  const instanceId = normalizeTaskField(input.instanceId, "instanceId", 80);
  const skillId = normalizeTaskField(input.skillId, "skillId", 80);
  const stageId = normalizeTaskField(input.stageId, "stageId", 80);
  const playbookId = normalizeTaskField(
    input.playbookId ?? "",
    "playbookId",
    MAX_PLAYBOOK_LENGTH,
  );
  const notes = normalizeTaskField(
    input.notes ?? "",
    "notes",
    MAX_NOTES_LENGTH,
  );

  if (!instanceId || !skillId || !stageId) {
    throw new Error(
      "createTaskAction: instanceId, skillId, and stageId are required",
    );
  }

  const repo = await getServerWorkflowRepository();
  const task = await repo.createTask({
    ...input,
    instanceId,
    skillId,
    stageId,
    notes,
    playbookId: playbookId || null,
    owners: normalizeOwnerList(input.owners) ?? [],
  });

  try {
    await repo.addEvent(task.id, {
      name: "workflow.task_created",
      description: `Created task: ${task.id}`,
      payload: {
        task_id: task.id,
        instance_id: task.instanceId,
        skill_id: task.skillId,
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
  const playbookId = normalizeTaskField(
    input.playbookId ?? "",
    "playbookId",
    MAX_PLAYBOOK_LENGTH,
  );
  const notes = normalizeTaskField(
    input.notes ?? "",
    "notes",
    MAX_NOTES_LENGTH,
  );

  if (!taskId) {
    throw new Error("updateTaskDetailsAction: taskId is required");
  }

  const repo = await getServerWorkflowRepository();
  const owners = normalizeOwnerList(input.owners);
  const task = await repo.updateTask(taskId, {
    playbookId: playbookId || null,
    notes,
    ...(owners !== undefined ? { owners } : {}),
    ...(Array.isArray(input.inputs) ? { inputs: input.inputs } : {}),
    ...(Array.isArray(input.outputs) ? { outputs: input.outputs } : {}),
  });

  try {
    await repo.addEvent(task.id, {
      name: "workflow.task_updated",
      description: `Updated task: ${task.id}`,
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

export async function setTaskStatusAction(
  taskId: string,
  status: WorkflowTaskStatus,
): Promise<{ task: WorkflowTask }> {
  const trimmedId = normalizeTaskField(taskId, "taskId", 80);
  if (!trimmedId) {
    throw new Error("setTaskStatusAction: taskId is required");
  }
  if (!isWorkflowTaskStatus(status)) {
    throw new Error("setTaskStatusAction: invalid status");
  }

  const repo = await getServerWorkflowRepository();
  const task = await repo.updateTask(trimmedId, { status });

  try {
    await repo.addEvent(task.id, {
      name: "workflow.task_status_set",
      description: `Status set to ${status}`,
      payload: {
        task_id: task.id,
        instance_id: task.instanceId,
        status,
      },
    });
  } catch (eventError) {
    captureError(eventError, {
      feature: "workflows.set_task_status",
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
  skillId: string,
  stageId: string,
): Promise<MoveTaskResult> {
  const trimmedTaskId = normalizeTaskField(taskId, "taskId", 80);
  const trimmedSkillId = normalizeTaskField(skillId, "skillId", 80);
  const trimmedStageId = normalizeTaskField(stageId, "stageId", 80);

  if (!trimmedTaskId || !trimmedSkillId || !trimmedStageId) {
    throw new Error("moveTaskAction: taskId, skillId, and stageId are required");
  }

  const repo = await getServerWorkflowRepository();
  const current = await repo.getTask(trimmedTaskId);
  if (!current) {
    throw new Error("moveTaskAction: task not found");
  }

  const task =
    current.skillId === trimmedSkillId && current.stageId === trimmedStageId
      ? current
      : await repo.updateTask(trimmedTaskId, {
          skillId: trimmedSkillId,
          stageId: trimmedStageId,
        });

  if (task !== current) {
    try {
      await repo.addEvent(task.id, {
        name: "workflow.task_moved",
        description: `Moved task: ${task.id}`,
        payload: {
          task_id: task.id,
          instance_id: task.instanceId,
          from_skill_id: current.skillId,
          from_stage_id: current.stageId,
          to_skill_id: task.skillId,
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

  // New precondition (PR 2 / AEL-60): "all inputs received and not paused".
  // We read drawer data so the gate sees per-instance task_inputs state, not
  // just the persisted column — a task may be persisted as not_started while
  // its linked inputs are already satisfied (pre-receipt path) or vice-versa.
  const drawer = await repo.getDrawerData(trimmedId);
  if (!drawer) throw new Error("startTaskAction: task not found");
  if (drawer.task.status === "paused") {
    throw new Error("startTaskAction: task is paused");
  }
  if (drawer.task.status === "complete" || drawer.task.status === "failed") {
    throw new Error("startTaskAction: task already terminal");
  }
  const linkedDefIds = new Set(drawer.task.inputs.map((i) => i.id));
  if (linkedDefIds.size > 0) {
    const receivedById = new Map(
      drawer.inputs.map((i) => [i.inputId, i.received]),
    );
    const allReceived = Array.from(linkedDefIds).every(
      (id) => receivedById.get(id) === true,
    );
    if (!allReceived) {
      throw new Error("startTaskAction: not all linked inputs received");
    }
  }
  const task = await repo.updateTask(trimmedId, { status: "in_progress" });

  try {
    await repo.addEvent(trimmedId, {
      name: "workflow.task_started",
      description: `Started task: ${task.id}`,
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
 * Stop an in-flight task run: persists `status: "failed"` and records
 * `workflow.run_cancelled`. Accepts both `in_progress` and `running` tasks
 * (the transient sub-state distinction is meaningless for cancellation).
 */
export async function cancelRunningTaskAction(
  taskId: string,
): Promise<{ task: WorkflowTask }> {
  const trimmedId = normalizeTaskField(taskId, "taskId", 80);
  if (!trimmedId) {
    throw new Error("cancelRunningTaskAction: taskId is required");
  }

  const repo = await getServerWorkflowRepository();
  const current = await repo.getTask(trimmedId);
  if (!current) {
    throw new Error("cancelRunningTaskAction: task not found");
  }
  if (current.status !== "in_progress" && current.status !== "running") {
    throw new Error("cancelRunningTaskAction: task is not in_progress or running");
  }
  const task = await repo.updateTask(trimmedId, { status: "failed" });

  try {
    await repo.addEvent(trimmedId, {
      name: "workflow.run_cancelled",
      description: `Failed run: ${task.id}`,
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
 * Resume a failed playbook run: `failed` → `in_progress`.
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
  const task = await repo.updateTaskIfStatus(trimmedId, "failed", {
    status: "in_progress",
  });
  if (!task) {
    const current = await repo.getTask(trimmedId);
    if (!current) {
      throw new Error("retryBlockedTaskAction: task not found");
    }
    throw new Error("retryBlockedTaskAction: task is not failed");
  }

  try {
    await repo.addEvent(trimmedId, {
      name: "workflow.run_retried",
      description: `Retried run: ${task.id}`,
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
      description: `Deleted task: ${task.id}`,
      payload: {
        task_id: task.id,
        instance_id: task.instanceId,
        skill_id: task.skillId,
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

function normalizeTemplateColor(value: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error("updateTemplateAction: template color is required");
  }
  return normalized;
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

function normalizeTemplateSkills(
  skills: WorkflowTemplate["skills"],
): WorkflowTemplate["skills"] {
  return skills
    .map((skill) => ({
      id: normalizeTaskField(skill.id, "skill.id", 80),
      label: trimTemplateLabel(skill.label),
      owners: (skill.owners ?? [])
        .map((owner) => trimTemplateLabel(owner))
        .filter(Boolean),
    }))
    .filter((skill) => skill.id && skill.label);
}

const MAX_INPUT_REF_LENGTH = 120;

function normalizeTemplateInputs(inputs: unknown): WorkflowInput[] {
  if (!Array.isArray(inputs)) return [];
  const seenIds = new Set<string>();
  const normalized: WorkflowInput[] = [];
  for (const raw of inputs as Partial<WorkflowInput>[]) {
    if (!raw || typeof raw !== "object") continue;
    const id = normalizeTaskField(raw.id ?? "", "input.id", MAX_INPUT_REF_LENGTH);
    if (!id || seenIds.has(id)) continue;
    const upstreamOutputId =
      typeof raw.upstreamOutputId === "string" && raw.upstreamOutputId.trim()
        ? raw.upstreamOutputId.trim().slice(0, MAX_INPUT_REF_LENGTH)
        : null;
    // Inputs must reference an upstream output. Rows without one are
    // dropped here (defensive belt against legacy clients that still
    // submit free-form rows).
    if (!upstreamOutputId) continue;
    seenIds.add(id);
    const upstreamTaskRef =
      typeof raw.upstreamTaskRef === "string" && raw.upstreamTaskRef.trim()
        ? raw.upstreamTaskRef.trim().slice(0, MAX_INPUT_REF_LENGTH)
        : undefined;
    normalized.push({
      id,
      upstreamOutputId,
      upstreamTaskRef,
    });
  }
  return normalized;
}

const VALID_OUTPUT_KINDS = new Set<PlaybookOutput["kind"]>([
  "file",
  "media",
  "link",
  "manual",
  "api",
]);

const MAX_OUTPUT_NAME_LENGTH = 80;
const MAX_OUTPUT_DESCRIPTION_LENGTH = 240;
const MAX_OUTPUT_ID_LENGTH = 120;

function normalizeTemplateOutputs(outputs: unknown): PlaybookOutput[] {
  if (!Array.isArray(outputs)) return [];
  const result: PlaybookOutput[] = [];
  for (const raw of outputs as PlaybookOutput[]) {
    if (!raw || typeof raw !== "object") continue;
    const id =
      typeof raw.id === "string" && raw.id.trim()
        ? raw.id.trim().slice(0, MAX_OUTPUT_ID_LENGTH)
        : "";
    if (!id) continue;
    const playbookId =
      typeof raw.playbookId === "string" && raw.playbookId.trim()
        ? raw.playbookId.trim().slice(0, MAX_PLAYBOOK_LENGTH)
        : "";
    const name =
      typeof raw.name === "string" && raw.name.trim()
        ? raw.name.trim().slice(0, MAX_OUTPUT_NAME_LENGTH)
        : "";
    const description =
      typeof raw.description === "string"
        ? raw.description.slice(0, MAX_OUTPUT_DESCRIPTION_LENGTH)
        : null;
    const kind =
      typeof raw.kind === "string" && VALID_OUTPUT_KINDS.has(raw.kind as PlaybookOutput["kind"])
        ? (raw.kind as PlaybookOutput["kind"])
        : null;
    const apiCheck =
      raw.apiCheck && typeof raw.apiCheck === "object" && !Array.isArray(raw.apiCheck)
        ? (raw.apiCheck as Record<string, unknown>)
        : null;
    const position =
      typeof raw.position === "number" && Number.isFinite(raw.position) ? raw.position : 0;
    const createdAt = typeof raw.createdAt === "string" ? raw.createdAt : "";
    result.push({ id, playbookId, name, description, kind, apiCheck, position, createdAt });
  }
  return result;
}

function normalizeTemplateTaskTemplates(
  taskTemplates: WorkflowTemplate["taskTemplates"],
): WorkflowTaskTemplate[] {
  return taskTemplates
    .map<WorkflowTaskTemplate>((task) => ({
      id: normalizeTaskField(task.id ?? "", "taskTemplate.id", 120),
      skillId: normalizeTaskField(task.skillId, "taskTemplate.skillId", 80),
      stageId: normalizeTaskField(task.stageId, "taskTemplate.stageId", 80),
      playbookId: task.playbookId
        ? normalizeTaskField(task.playbookId, "taskTemplate.playbookId", MAX_PLAYBOOK_LENGTH)
        : null,
      notes: normalizeTaskField(task.notes ?? "", "taskTemplate.notes", MAX_NOTES_LENGTH),
      inputs: normalizeTemplateInputs(task.inputs),
      // Persist the per-task outputs snapshot (PR AEL-XXX, see
      // 20260515120000_workflow_task_outputs_snapshot.sql). Previously this
      // field was dropped on every save, silently emptying every task's
      // outputs in JSONB whenever the editor or the playbook drawer saved.
      outputs: normalizeTemplateOutputs(task.outputs),
      checkpoint: Boolean(task.checkpoint),
      owners: normalizeOwnerList(task.owners) ?? [],
    }))
    .filter((task) => task.id && task.skillId && task.stageId);
}

/**
 * Cross-check `upstreamOutputId`s on the normalized task templates against
 * the playbooks attached to the same template. Throws a friendly error if
 * any wired output id no longer belongs to one of the template's playbooks
 * (the picker showed it once but the underlying output was deleted or
 * moved). The client refetches `listOutputsForTemplateAction` and retries.
 */
async function assertWiredOutputsBelongToTemplate(
  taskTemplates: WorkflowTaskTemplate[],
): Promise<void> {
  const wiredIds = Array.from(
    new Set(
      taskTemplates.flatMap((task) =>
        (task.inputs ?? [])
          .map((input) => input.upstreamOutputId)
          .filter((id): id is string => typeof id === "string" && id.trim().length > 0),
      ),
    ),
  );
  if (wiredIds.length === 0) return;

  const allowedPlaybookIds = new Set(
    taskTemplates
      .map((task) => task.playbookId)
      .filter((id): id is string => typeof id === "string" && id.trim().length > 0),
  );

  const repo = await getServerWorkflowRepository();
  const groups = new Map<string, string>();
  for (const id of allowedPlaybookIds) {
    const outputs = await repo.listPlaybookOutputs(id);
    for (const output of outputs) groups.set(output.id, id);
  }

  for (const id of wiredIds) {
    const owner = groups.get(id);
    if (!owner || !allowedPlaybookIds.has(owner)) {
      throw new WorkflowRepositoryError(
        "That wired output is no longer available on this template — please re-pick.",
        null,
        { code: "stale_output_ref" },
      );
    }
  }
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

  const normalizedTaskTemplates = normalizeTemplateTaskTemplates(template.taskTemplates);
  await assertWiredOutputsBelongToTemplate(normalizedTaskTemplates);

  const repo = await getServerWorkflowRepository();
  const updatedTemplate = await repo.updateTemplate(trimmedTemplateId, {
    label: trimTemplateLabel(template.label),
    color: normalizeTemplateColor(template.color),
    stages: normalizeTemplateStages(template.stages),
    skills: normalizeTemplateSkills(template.skills),
    taskTemplates: normalizedTaskTemplates,
  });

  revalidatePath("/", "layout");
  revalidatePath(`/workflows/templates/${trimmedTemplateId}/edit`);

  return { template: updatedTemplate };
}

/**
 * Outputs grouped per playbook attached to the given template — drives the
 * input-wiring picker in the template editor. The picker scope is limited
 * to the template's own playbooks so wiring stays visually local; a
 * downstream task can only reference outputs from another task already on
 * the same template (per AEL-64 spec).
 */
export async function listOutputsForTemplateAction(
  templateId: string,
): Promise<TemplateOutputGroup[]> {
  const trimmedTemplateId = normalizeTaskField(templateId, "templateId", 120);
  if (!trimmedTemplateId) {
    throw new Error("listOutputsForTemplateAction: templateId is required");
  }
  const repo = await getServerWorkflowRepository();
  return repo.listOutputsForTemplate(trimmedTemplateId);
}

export async function renameTemplateAction(
  templateId: string,
  rawLabel: string,
): Promise<{ template: WorkflowTemplate }> {
  const trimmedTemplateId = normalizeTaskField(templateId, "templateId", 120);
  const label = normalizeTaskField(rawLabel, "label", MAX_LABEL_LENGTH);
  if (!trimmedTemplateId || !label) {
    throw new Error("renameTemplateAction: templateId and label are required");
  }

  const repo = await getServerWorkflowRepository();
  const template = await repo.updateTemplate(trimmedTemplateId, { label });

  revalidatePath("/", "layout");
  revalidatePath(`/workflows/templates/${trimmedTemplateId}/edit`);
  return { template };
}

export interface CreateTemplateResult {
  template: WorkflowTemplate;
}

export async function createTemplateAction(
  rawLabel: string,
  rawColor: string,
): Promise<CreateTemplateResult> {
  const label = rawLabel.trim().slice(0, MAX_LABEL_LENGTH);
  if (!label) {
    throw new Error("createTemplateAction: label cannot be empty");
  }
  const color = rawColor.trim();
  if (!color) {
    throw new Error("createTemplateAction: color cannot be empty");
  }

  const repo = await getServerWorkflowRepository();
  const template = await repo.createTemplate(label, color);

  revalidatePath("/", "layout");

  return { template };
}

export async function deleteTemplateAction(templateId: string): Promise<void> {
  const trimmedTemplateId = normalizeTaskField(templateId, "templateId", 120);
  if (!trimmedTemplateId) {
    throw new Error("deleteTemplateAction: templateId is required");
  }

  const repo = await getServerWorkflowRepository();
  await repo.deleteTemplate(trimmedTemplateId);

  revalidatePath("/", "layout");
}

// ---------------------------------------------------------------------------
// PR 2 / AEL-60 — drawer IO actions. The redesigned drawer (PR 3) calls
// these to flip per-task input/output state. Each one persists, then emits
// a domain event so the audit trail and analytics pick up the change.
// ---------------------------------------------------------------------------

export async function getDrawerDataAction(
  taskId: string,
): Promise<DrawerData | null> {
  const trimmedId = normalizeTaskField(taskId, "taskId", 80);
  if (!trimmedId) throw new Error("getDrawerDataAction: taskId is required");
  const repo = await getServerWorkflowRepository();
  return repo.getDrawerData(trimmedId);
}

async function emitTaskEvent(
  feature: string,
  name: string,
  description: string,
  task: WorkflowTask,
  payload: Record<string, unknown> = {},
): Promise<void> {
  const repo = await getServerWorkflowRepository();
  try {
    await repo.addEvent(task.id, {
      name,
      description,
      payload: { task_id: task.id, instance_id: task.instanceId, ...payload },
    });
  } catch (eventError) {
    captureError(eventError, {
      feature,
      action: "addEvent",
      extra: { task_id: task.id, instance_id: task.instanceId },
    });
  }
}

export async function markInputReceivedAction(
  taskId: string,
  inputId: string,
): Promise<{ input: TaskInputState }> {
  const trimmedId = normalizeTaskField(taskId, "taskId", 80);
  const trimmedInputId = normalizeTaskField(inputId, "inputId", 120);
  if (!trimmedId || !trimmedInputId) {
    throw new Error("markInputReceivedAction: taskId and inputId are required");
  }

  const repo = await getServerWorkflowRepository();
  const input = await repo.markInputReceived(trimmedId, trimmedInputId);
  const task = await repo.getTask(trimmedId);
  if (task) {
    await emitTaskEvent(
      "workflows.mark_input_received",
      "workflow.input_received",
      `Input received: ${trimmedInputId}`,
      task,
      { input_id: trimmedInputId, mode: "manual" },
    );
  }

  revalidatePath("/", "layout");
  return { input };
}

export async function bypassInputAction(
  taskId: string,
  inputId: string,
): Promise<{ input: TaskInputState }> {
  const trimmedId = normalizeTaskField(taskId, "taskId", 80);
  const trimmedInputId = normalizeTaskField(inputId, "inputId", 120);
  if (!trimmedId || !trimmedInputId) {
    throw new Error("bypassInputAction: taskId and inputId are required");
  }

  const repo = await getServerWorkflowRepository();
  const input = await repo.bypassInput(trimmedId, trimmedInputId);
  const task = await repo.getTask(trimmedId);
  if (task) {
    await emitTaskEvent(
      "workflows.bypass_input",
      "workflow.input_bypassed",
      `Input bypassed: ${trimmedInputId}`,
      task,
      { input_id: trimmedInputId, mode: "bypass" },
    );
  }

  revalidatePath("/", "layout");
  return { input };
}

export async function produceOutputAction(
  taskId: string,
  outputId: string,
  artifact?: OutputArtifact,
): Promise<{ output: TaskOutput }> {
  const trimmedId = normalizeTaskField(taskId, "taskId", 80);
  const trimmedOutputId = normalizeTaskField(outputId, "outputId", 80);
  if (!trimmedId || !trimmedOutputId) {
    throw new Error("produceOutputAction: taskId and outputId are required");
  }

  const repo = await getServerWorkflowRepository();
  const output = await repo.produceOutput(trimmedId, trimmedOutputId, artifact);
  const task = await repo.getTask(trimmedId);
  if (task) {
    await emitTaskEvent(
      "workflows.produce_output",
      "workflow.output_produced",
      `Output produced: ${trimmedOutputId}`,
      task,
      {
        output_id: trimmedOutputId,
        artifact_url: artifact?.artifactUrl ?? null,
      },
    );
  }

  revalidatePath("/", "layout");
  return { output };
}

const MAX_PAUSE_REASON_LENGTH = 80;

export async function pauseTaskAction(
  taskId: string,
  reason: string,
): Promise<{ task: WorkflowTask }> {
  const trimmedId = normalizeTaskField(taskId, "taskId", 80);
  const trimmedReason = normalizeTaskField(reason, "reason", MAX_PAUSE_REASON_LENGTH);
  if (!trimmedId || !trimmedReason) {
    throw new Error("pauseTaskAction: taskId and reason are required");
  }

  const repo = await getServerWorkflowRepository();
  const task = await repo.pauseTask(trimmedId, trimmedReason);
  await emitTaskEvent(
    "workflows.pause_task",
    "workflow.task_paused",
    `Paused: ${trimmedReason}`,
    task,
    { reason: trimmedReason },
  );

  revalidatePath("/", "layout");
  return { task };
}

export async function resumeTaskAction(
  taskId: string,
): Promise<{ task: WorkflowTask }> {
  const trimmedId = normalizeTaskField(taskId, "taskId", 80);
  if (!trimmedId) throw new Error("resumeTaskAction: taskId is required");

  const repo = await getServerWorkflowRepository();
  const task = await repo.resumeTask(trimmedId);
  await emitTaskEvent(
    "workflows.resume_task",
    "workflow.task_resumed",
    `Resumed: ${task.id}`,
    task,
  );

  revalidatePath("/", "layout");
  return { task };
}

/**
 * Stub: PR 3 wires the drawer's "refine playbook" affordance. There is no
 * agent runtime in PR 2 yet, so this action only emits a domain event the
 * drawer can render in the activity feed.
 */
export async function refinePlaybookAction(
  taskId: string,
): Promise<{ task: WorkflowTask }> {
  const trimmedId = normalizeTaskField(taskId, "taskId", 80);
  if (!trimmedId) throw new Error("refinePlaybookAction: taskId is required");

  const repo = await getServerWorkflowRepository();
  const task = await repo.getTask(trimmedId);
  if (!task) throw new Error("refinePlaybookAction: task not found");

  await emitTaskEvent(
    "workflows.refine_playbook",
    "workflow.playbook_refine_requested",
    `Refine requested: ${task.id}`,
    task,
  );

  revalidatePath("/", "layout");
  return { task };
}

/**
 * Read the diff between an instance and its template. Called by the sync
 * drawer when it opens. Pure read — no revalidate.
 */
export async function getInstanceTemplateDiffAction(
  instanceId: string,
): Promise<{ diff: InstanceTemplateDiff }> {
  const trimmedId = normalizeTaskField(instanceId, "instanceId", 80);
  if (!trimmedId) {
    throw new Error("getInstanceTemplateDiffAction: instanceId is required");
  }
  const repo = await getServerWorkflowRepository();
  const diff = await repo.getInstanceTemplateDiff(trimmedId);
  return { diff };
}

/**
 * Apply the user-selected subset of a template→instance diff. Server
 * re-derives the diff and re-checks pristine on every task update; non-
 * applicable selection entries are silently dropped.
 */
export async function applyTemplateSyncAction(
  instanceId: string,
  selection: TemplateSyncSelection,
): Promise<{ instance: WorkflowInstanceDetail }> {
  const trimmedId = normalizeTaskField(instanceId, "instanceId", 80);
  if (!trimmedId) {
    throw new Error("applyTemplateSyncAction: instanceId is required");
  }
  if (!selection || typeof selection !== "object") {
    throw new Error("applyTemplateSyncAction: selection is required");
  }
  // Defensive — coerce missing arrays to empty so partial selections don't
  // crash applyTemplateSync downstream.
  const safeSelection: TemplateSyncSelection = {
    stageIdsToAdd: Array.isArray(selection.stageIdsToAdd) ? selection.stageIdsToAdd : [],
    skillIdsToAdd: Array.isArray(selection.skillIdsToAdd) ? selection.skillIdsToAdd : [],
    stageIdsToRename: Array.isArray(selection.stageIdsToRename) ? selection.stageIdsToRename : [],
    skillIdsToRename: Array.isArray(selection.skillIdsToRename) ? selection.skillIdsToRename : [],
    taskTemplateIdsToAdd: Array.isArray(selection.taskTemplateIdsToAdd)
      ? selection.taskTemplateIdsToAdd
      : [],
    instanceTaskIdsToUpdate: Array.isArray(selection.instanceTaskIdsToUpdate)
      ? selection.instanceTaskIdsToUpdate
      : [],
  };

  const repo = await getServerWorkflowRepository();
  const instance = await repo.applyTemplateSync(trimmedId, safeSelection);
  revalidatePath("/", "layout");
  revalidatePath(`/workflows/${trimmedId}`);
  if (instance.templateId) {
    revalidatePath(`/workflows/templates/${instance.templateId}`);
  }
  return { instance };
}
