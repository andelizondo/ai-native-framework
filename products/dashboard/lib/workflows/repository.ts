import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  DrawerData,
  FrameworkItem,
  FrameworkItemType,
  InstanceTemplateDiff,
  OutputArtifact,
  PlaybookInput,
  PlaybookOutput,
  PlaybookOutputKind,
  TaskIOSummary,
  TaskInputState,
  TaskOutput,
  TaskOutputStatus,
  TemplateMatrix,
  TemplateOutputGroup,
  TemplateSyncSelection,
  WorkflowEvent,
  WorkflowEventInput,
  WorkflowInput,
  WorkflowInstance,
  WorkflowInstanceDetail,
  WorkflowCheckpointTransitionStatus,
  WorkflowRepository,
  WorkflowSkill,
  WorkflowStage,
  WorkflowTask,
  WorkflowTaskCreateInput,
  WorkflowTaskPatch,
  WorkflowTaskStatus,
  WorkflowTaskTemplate,
  WorkflowTemplatePatch,
  WorkflowTemplate,
} from "./types";

import {
  diffInstanceFromTemplate,
  filterApplicableTaskUpdates,
} from "./template-sync";
import { aggregateTasksByTemplateCell } from "./aggregate";

interface WorkflowTemplateRow {
  id: string;
  label: string;
  color: string;
  multi_instance: boolean;
  stages: unknown;
  skills: unknown;
  task_templates: unknown;
  created_at: string;
  updated_at: string;
}

interface WorkflowInstanceRow {
  id: string;
  template_id: string;
  label: string;
  status: WorkflowInstance["status"];
  stages: unknown;
  skills: unknown;
  template_synced_at: string | null;
  created_at: string;
  updated_at: string;
}

interface WorkflowTaskRow {
  id: string;
  instance_id: string;
  skill_id: string;
  stage_id: string;
  notes: string;
  status: WorkflowTask["status"];
  substatus: string;
  checkpoint: boolean;
  inputs: unknown;
  outputs: unknown;
  playbook_id: string | null;
  owners: unknown;
  template_task_id: string | null;
  paused_reason: string | null;
  paused_by: string | null;
  paused_at: string | null;
  created_at: string;
  updated_at: string;
}

interface PlaybookOutputRow {
  id: string;
  playbook_id: string;
  name: string;
  description: string | null;
  kind: PlaybookOutputKind | null;
  api_check: unknown;
  position: number;
  created_at: string;
}

interface PlaybookInputRow {
  id: string;
  playbook_id: string;
  upstream_output_id: string;
  position: number;
  created_at: string;
}

interface TaskOutputRow {
  id: string;
  task_id: string;
  output_id: string;
  status: TaskOutputStatus;
  artifact_url: string | null;
  artifact_meta: unknown;
  produced_by: string | null;
  produced_at: string | null;
  created_at: string;
}

interface TaskInputRow {
  id: string;
  task_id: string;
  input_id: string;
  received: boolean;
  received_at: string | null;
  received_from: string | null;
}

interface WorkflowEventRow {
  id: string;
  instance_id: string;
  task_id: string | null;
  name: string;
  description: string;
  payload: unknown;
  created_at: string;
}

interface FrameworkItemRow {
  id: string;
  type: FrameworkItemType;
  name: string;
  description: string;
  icon: string | null;
  color: string | null;
  content: string;
  created_at: string;
  updated_at: string;
}

interface AllowedSkillRow {
  playbook_id: string;
  skill_id: string;
}

function toJsonArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function toJsonObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/**
 * Read-side migration for `WorkflowSkill`: rows authored before the
 * multi-owner change carry a single `owner: string`. Wrap that into a
 * one-element `owners` array so the rest of the app sees a uniform shape.
 */
function migrateSkill(raw: unknown): WorkflowSkill {
  const obj = raw as { id: string; label: string; owner?: string; owners?: unknown };
  if (Array.isArray(obj.owners)) {
    return {
      id: obj.id,
      label: obj.label,
      owners: obj.owners.filter((o): o is string => typeof o === "string" && o.trim().length > 0),
    };
  }
  const legacy = typeof obj.owner === "string" ? obj.owner.trim() : "";
  return {
    id: obj.id,
    label: obj.label,
    owners: legacy ? [legacy] : [],
  };
}

function migrateSkills(raw: unknown): WorkflowSkill[] {
  return toJsonArray<unknown>(raw).map(migrateSkill);
}

/**
 * Read the `inputs` JSONB column. Every entry must carry an
 * `upstreamOutputId`; rows missing one are filtered out. The 20260516
 * migration prunes pre-existing JSONB so this filter is a defensive belt
 * for any rows the migration didn't reach (e.g. running in tests with
 * unmigrated fixtures).
 */
function normalizeInputs(raw: unknown): WorkflowInput[] {
  return toJsonArray<Record<string, unknown>>(raw)
    .map((item): WorkflowInput | null => {
      if (item == null) return null;
      const id = typeof item.id === "string" && item.id.trim() ? item.id.trim() : null;
      if (!id) return null;
      const upstreamOutputId =
        typeof item.upstreamOutputId === "string" && item.upstreamOutputId.trim()
          ? item.upstreamOutputId.trim()
          : null;
      if (!upstreamOutputId) return null;
      const upstreamTaskRef =
        typeof item.upstreamTaskRef === "string" && item.upstreamTaskRef.trim()
          ? item.upstreamTaskRef.trim()
          : undefined;
      return {
        id,
        upstreamOutputId,
        upstreamTaskRef,
      } satisfies WorkflowInput;
    })
    .filter((value): value is WorkflowInput => value !== null);
}

function inputsToJsonb(inputs: WorkflowInput[]): unknown[] {
  return inputs.map((input) => ({
    id: input.id,
    upstreamOutputId: input.upstreamOutputId,
    upstreamTaskRef: input.upstreamTaskRef ?? null,
  }));
}

const VALID_OUTPUT_KINDS = new Set<PlaybookOutputKind>([
  "file",
  "media",
  "link",
  "manual",
  "api",
]);

/** Read the per-task `outputs` JSONB column and coerce it into the canonical
 *  `PlaybookOutput[]` shape. Tolerates rows authored before this column
 *  existed (returns []) and rows that had stray extra keys. */
function normalizeOutputsSnapshot(raw: unknown): PlaybookOutput[] {
  return toJsonArray<Record<string, unknown>>(raw)
    .map((item, index): PlaybookOutput | null => {
      if (item == null || typeof item !== "object") return null;
      const id = typeof item.id === "string" && item.id.trim() ? item.id.trim() : null;
      if (!id) return null;
      const playbookId =
        typeof item.playbookId === "string" && item.playbookId.trim()
          ? item.playbookId.trim()
          : "";
      const name = typeof item.name === "string" ? item.name : "";
      const description =
        typeof item.description === "string" ? item.description : null;
      const kindCandidate = typeof item.kind === "string" ? item.kind : null;
      const kind =
        kindCandidate && VALID_OUTPUT_KINDS.has(kindCandidate as PlaybookOutputKind)
          ? (kindCandidate as PlaybookOutputKind)
          : null;
      const apiCheck =
        item.apiCheck && typeof item.apiCheck === "object" && !Array.isArray(item.apiCheck)
          ? (item.apiCheck as Record<string, unknown>)
          : null;
      const position =
        typeof item.position === "number" && Number.isFinite(item.position)
          ? item.position
          : index;
      const createdAt =
        typeof item.createdAt === "string" ? item.createdAt : new Date(0).toISOString();
      return {
        id,
        playbookId,
        name,
        description,
        kind,
        apiCheck,
        position,
        createdAt,
      };
    })
    .filter((value): value is PlaybookOutput => value !== null)
    .sort((a, b) => a.position - b.position);
}

function outputsToJsonb(outputs: PlaybookOutput[]): unknown[] {
  return outputs.map((output, index) => ({
    id: output.id,
    playbookId: output.playbookId,
    name: output.name,
    description: output.description ?? null,
    kind: output.kind,
    apiCheck: output.apiCheck ?? null,
    // Re-stamp position from array order so reorder edits in the drawer
    // persist without callers having to maintain `position` themselves.
    position: index,
    createdAt: output.createdAt,
  }));
}

function mapTemplate(row: WorkflowTemplateRow): WorkflowTemplate {
  const taskTemplates = toJsonArray<WorkflowTaskTemplate>(row.task_templates).map(
    (task, index) => ({
      ...task,
      id:
        typeof task.id === "string" && task.id.trim()
          ? task.id
          : `${row.id}::${task.skillId}::${task.stageId}::${index}`,
    }),
  );

  return {
    id: row.id,
    label: row.label,
    color: row.color,
    multiInstance: row.multi_instance,
    stages: toJsonArray(row.stages),
    skills: migrateSkills(row.skills),
    taskTemplates,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapInstance(row: WorkflowInstanceRow): WorkflowInstance {
  return {
    id: row.id,
    templateId: row.template_id,
    label: row.label,
    status: row.status,
    stages: toJsonArray(row.stages),
    skills: migrateSkills(row.skills),
    templateSyncedAt: row.template_synced_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapTask(row: WorkflowTaskRow): WorkflowTask {
  return {
    id: row.id,
    instanceId: row.instance_id,
    skillId: row.skill_id,
    stageId: row.stage_id,
    notes: row.notes ?? "",
    status: row.status,
    substatus: row.substatus,
    checkpoint: row.checkpoint,
    inputs: normalizeInputs(row.inputs),
    outputs: normalizeOutputsSnapshot(row.outputs),
    playbookId: row.playbook_id,
    owners: toJsonArray<unknown>(row.owners)
      .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
      .map((value) => value.trim()),
    templateTaskId: row.template_task_id ?? null,
    pausedReason: row.paused_reason,
    pausedBy: row.paused_by,
    pausedAt: row.paused_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapPlaybookOutput(row: PlaybookOutputRow): PlaybookOutput {
  return {
    id: row.id,
    playbookId: row.playbook_id,
    name: row.name,
    description: row.description,
    kind: row.kind,
    apiCheck: (row.api_check as Record<string, unknown> | null) ?? null,
    position: row.position,
    createdAt: row.created_at,
  };
}

interface PlaybookInputHydration {
  upstreamOutputName: string;
  upstreamOutputKind: PlaybookOutputKind | null;
  upstreamPlaybookId: string;
  upstreamPlaybookName: string;
}

function mapPlaybookInput(
  row: PlaybookInputRow,
  hydration: PlaybookInputHydration,
): PlaybookInput {
  return {
    id: row.id,
    playbookId: row.playbook_id,
    upstreamOutputId: row.upstream_output_id,
    position: row.position,
    createdAt: row.created_at,
    upstreamOutputName: hydration.upstreamOutputName,
    upstreamOutputKind: hydration.upstreamOutputKind,
    upstreamPlaybookId: hydration.upstreamPlaybookId,
    upstreamPlaybookName: hydration.upstreamPlaybookName,
  };
}

/** Two-step join: fetch the upstream `playbook_outputs` rows referenced by
 *  the given input rows, then the upstream `framework_items` for each
 *  output's playbook. Rows whose upstream output has been deleted are
 *  dropped (the FK is `on delete cascade` so this is defensive — covers
 *  the race window between fetch and cascade fire). */
async function hydratePlaybookInputs(
  client: SupabaseClient,
  rows: PlaybookInputRow[],
): Promise<PlaybookInput[]> {
  if (rows.length === 0) return [];
  const outputIds = Array.from(new Set(rows.map((r) => r.upstream_output_id)));
  const { data: outputRows, error: outErr } = await client
    .from("playbook_outputs")
    .select("id,playbook_id,name,kind")
    .in("id", outputIds);
  if (outErr) {
    throw new WorkflowRepositoryError("hydratePlaybookInputs outputs lookup failed", outErr);
  }
  const outputById = new Map<
    string,
    { id: string; playbookId: string; name: string; kind: PlaybookOutputKind | null }
  >();
  for (const r of (outputRows ?? []) as {
    id: string;
    playbook_id: string;
    name: string;
    kind: PlaybookOutputKind | null;
  }[]) {
    outputById.set(r.id, {
      id: r.id,
      playbookId: r.playbook_id,
      name: r.name,
      kind: r.kind,
    });
  }
  const upstreamPlaybookIds = Array.from(
    new Set(
      Array.from(outputById.values()).map((o) => o.playbookId),
    ),
  );
  const { data: itemRows, error: itemErr } = await client
    .from("framework_items")
    .select("id,name")
    .in("id", upstreamPlaybookIds);
  if (itemErr) {
    throw new WorkflowRepositoryError("hydratePlaybookInputs playbook lookup failed", itemErr);
  }
  const playbookNameById = new Map<string, string>();
  for (const r of (itemRows ?? []) as { id: string; name: string }[]) {
    playbookNameById.set(r.id, r.name);
  }
  return rows
    .map((row): PlaybookInput | null => {
      const upstream = outputById.get(row.upstream_output_id);
      if (!upstream) return null;
      return mapPlaybookInput(row, {
        upstreamOutputName: upstream.name,
        upstreamOutputKind: upstream.kind,
        upstreamPlaybookId: upstream.playbookId,
        upstreamPlaybookName: playbookNameById.get(upstream.playbookId) ?? "Unknown playbook",
      });
    })
    .filter((value): value is PlaybookInput => value !== null);
}

function mapTaskOutput(row: TaskOutputRow): TaskOutput {
  return {
    id: row.id,
    taskId: row.task_id,
    outputId: row.output_id,
    status: row.status,
    artifactUrl: row.artifact_url,
    artifactMeta: (row.artifact_meta as Record<string, unknown> | null) ?? null,
    producedBy: row.produced_by,
    producedAt: row.produced_at,
    createdAt: row.created_at,
  };
}

function mapTaskInput(row: TaskInputRow): TaskInputState {
  return {
    id: row.id,
    taskId: row.task_id,
    inputId: row.input_id,
    received: row.received,
    receivedAt: row.received_at,
    receivedFrom: row.received_from,
  };
}

function mapEvent(row: WorkflowEventRow): WorkflowEvent {
  return {
    id: row.id,
    instanceId: row.instance_id,
    taskId: row.task_id,
    name: row.name,
    description: row.description,
    payload: toJsonObject(row.payload),
    createdAt: row.created_at,
  };
}

function mapFrameworkItem(
  row: FrameworkItemRow,
  allowedSkillIds?: string[],
  allowedPlaybookIds?: string[],
): FrameworkItem {
  const item: FrameworkItem = {
    id: row.id,
    type: row.type,
    name: row.name,
    description: row.description,
    icon: row.icon,
    color: row.color,
    content: row.content,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
  if (row.type === "playbook") {
    item.allowedSkillIds = allowedSkillIds ?? [];
  } else if (row.type === "skill") {
    item.allowedPlaybookIds = allowedPlaybookIds ?? [];
  }
  return item;
}

function patchToRow(patch: WorkflowTaskPatch): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (patch.skillId !== undefined) row.skill_id = patch.skillId;
  if (patch.stageId !== undefined) row.stage_id = patch.stageId;
  if (patch.notes !== undefined) row.notes = patch.notes;
  if (patch.status !== undefined) row.status = patch.status;
  if (patch.substatus !== undefined) row.substatus = patch.substatus;
  if (patch.checkpoint !== undefined) row.checkpoint = patch.checkpoint;
  if (patch.inputs !== undefined) row.inputs = inputsToJsonb(patch.inputs);
  if (patch.outputs !== undefined) row.outputs = outputsToJsonb(patch.outputs);
  if (patch.playbookId !== undefined) row.playbook_id = patch.playbookId;
  if (patch.owners !== undefined) row.owners = patch.owners;
  if (patch.pausedReason !== undefined) row.paused_reason = patch.pausedReason;
  if (patch.pausedBy !== undefined) row.paused_by = patch.pausedBy;
  if (patch.pausedAt !== undefined) row.paused_at = patch.pausedAt;
  return row;
}

function templatePatchToRow(
  patch: WorkflowTemplatePatch,
): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (patch.label !== undefined) row.label = patch.label;
  if (patch.color !== undefined) row.color = patch.color;
  if (patch.stages !== undefined) row.stages = patch.stages;
  if (patch.skills !== undefined) row.skills = patch.skills;
  if (patch.taskTemplates !== undefined) row.task_templates = patch.taskTemplates;
  return row;
}

export type WorkflowRepositoryErrorCode =
  | "unique_name"
  | "unique_upstream"
  | "stale_output_ref";

export class WorkflowRepositoryError extends Error {
  readonly cause?: unknown;
  readonly code?: WorkflowRepositoryErrorCode;
  constructor(
    message: string,
    cause?: unknown,
    options?: { code?: WorkflowRepositoryErrorCode },
  ) {
    // Compose the underlying Supabase error's message + code into our own
    // so a toast like "upsertFrameworkItem allowed_playbooks insert failed"
    // surfaces the actual reason (FK violation, RLS, etc.) instead of just
    // the wrapper label.
    const detail = describeCause(cause);
    super(detail ? `${message} — ${detail}` : message);
    this.name = "WorkflowRepositoryError";
    this.cause = cause;
    this.code = options?.code;
  }
}

function describeCause(cause: unknown): string {
  if (!cause || typeof cause !== "object") return "";
  const obj = cause as {
    message?: unknown;
    code?: unknown;
    details?: unknown;
    hint?: unknown;
  };
  const parts: string[] = [];
  if (typeof obj.message === "string" && obj.message.trim().length > 0) {
    parts.push(obj.message);
  }
  if (typeof obj.code === "string" && obj.code.length > 0) {
    parts.push(`(${obj.code})`);
  }
  if (typeof obj.details === "string" && obj.details.trim().length > 0) {
    parts.push(obj.details);
  }
  return parts.join(" ");
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "23505"
  );
}

/**
 * Returns the subset of `requestedIds` that actually exists in
 * `framework_items` with the given `type`. Used to scrub stale references
 * out of `allowedSkillIds` / `allowedPlaybookIds` before we try to write
 * them to the join table — without this, a deleted playbook (or a draft
 * id that never made it to the items table) surfaces as an opaque FK
 * violation on insert.
 */
async function filterExistingFrameworkItemIds(
  client: SupabaseClient,
  requestedIds: string[],
  type: "skill" | "playbook",
): Promise<string[]> {
  if (requestedIds.length === 0) return [];
  const { data, error } = await client
    .from("framework_items")
    .select("id")
    .eq("type", type)
    .in("id", requestedIds);
  if (error) {
    throw new WorkflowRepositoryError(
      `filterExistingFrameworkItemIds failed (${type})`,
      error,
    );
  }
  const existing = new Set((data ?? []).map((row) => row.id as string));
  // Preserve the caller's order while dropping unknown ids.
  return requestedIds.filter((id) => existing.has(id));
}

/**
 * Batch-load per-task IO state for an instance: outputs progress (one row per
 * `playbook_outputs` declaration, joined with the matching `task_outputs`
 * status if present) and a boolean flag for any unsatisfied `linked` input.
 *
 * Three queries scoped to the instance's task ids — small fixed cost regardless
 * of task count, so the matrix avoids per-card fetches.
 */
async function loadInstanceTaskIO(
  client: SupabaseClient,
  tasks: WorkflowTask[],
): Promise<TaskIOSummary[]> {
  if (tasks.length === 0) return [];
  const taskIds = tasks.map((t) => t.id);

  // Snapshots are the source of truth for which outputs each task carries.
  // Only fall back to live `playbook_outputs` for tasks whose snapshot is
  // empty AND that have a playbook attached — handles legacy rows authored
  // before the snapshot column existed.
  const fallbackPlaybookIds = Array.from(
    new Set(
      tasks
        .filter((t) => t.outputs.length === 0 && Boolean(t.playbookId))
        .map((t) => t.playbookId as string),
    ),
  );

  const [pbOutputsRes, taskOutputsRes, taskInputsRes] = await Promise.all([
    fallbackPlaybookIds.length > 0
      ? client
          .from("playbook_outputs")
          .select("*")
          .in("playbook_id", fallbackPlaybookIds)
          .order("position", { ascending: true })
      : Promise.resolve({ data: [], error: null } as const),
    client.from("task_outputs").select("*").in("task_id", taskIds),
    client.from("task_inputs").select("*").in("task_id", taskIds),
  ]);

  if (pbOutputsRes.error) {
    throw new WorkflowRepositoryError("loadInstanceTaskIO playbook_outputs failed", pbOutputsRes.error);
  }
  if (taskOutputsRes.error) {
    throw new WorkflowRepositoryError("loadInstanceTaskIO task_outputs failed", taskOutputsRes.error);
  }
  if (taskInputsRes.error) {
    throw new WorkflowRepositoryError("loadInstanceTaskIO task_inputs failed", taskInputsRes.error);
  }

  const fallbackByPlaybook = new Map<string, PlaybookOutput[]>();
  for (const row of (pbOutputsRes.data ?? []) as PlaybookOutputRow[]) {
    const list = fallbackByPlaybook.get(row.playbook_id) ?? [];
    list.push(mapPlaybookOutput(row));
    fallbackByPlaybook.set(row.playbook_id, list);
  }

  const taskOutputByTaskAndOutput = new Map<string, TaskOutputRow>();
  for (const row of (taskOutputsRes.data ?? []) as TaskOutputRow[]) {
    taskOutputByTaskAndOutput.set(`${row.task_id}::${row.output_id}`, row);
  }

  const receivedInputsByTask = new Map<string, Set<string>>();
  for (const row of (taskInputsRes.data ?? []) as TaskInputRow[]) {
    if (!row.received) continue;
    const set = receivedInputsByTask.get(row.task_id) ?? new Set<string>();
    set.add(row.input_id);
    receivedInputsByTask.set(row.task_id, set);
  }

  return tasks.map((task) => {
    const taskOutputs =
      task.outputs.length > 0
        ? task.outputs
        : task.playbookId
          ? (fallbackByPlaybook.get(task.playbookId) ?? [])
          : [];
    const outputs = taskOutputs
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((po) => {
        const tor = taskOutputByTaskAndOutput.get(`${task.id}::${po.id}`);
        return {
          id: po.id,
          position: po.position,
          status: (tor?.status ?? "pending") as TaskOutputStatus,
          name: po.name,
        };
      });
    const received = receivedInputsByTask.get(task.id) ?? new Set<string>();
    const hasUnmetLinkedInput = task.inputs.some(
      (input) => !received.has(input.id),
    );
    return { taskId: task.id, outputs, hasUnmetLinkedInput };
  });
}

/**
 * One-shot loader used by both `getInstanceTemplateDiff` and
 * `applyTemplateSync`. Pulls the template, instance, tasks, and per-task IO
 * summary in parallel — same data the pure `diffInstanceFromTemplate`
 * function expects. Kept separate from `getInstance` because we always need
 * the template here (not optional) and we don't care about events.
 */
async function loadInstanceDetailForSync(
  client: SupabaseClient,
  instanceId: string,
): Promise<{
  template: WorkflowTemplate;
  instance: WorkflowInstance;
  tasks: WorkflowTask[];
  taskIO: TaskIOSummary[];
}> {
  const { data: instanceRow, error: instErr } = await client
    .from("workflow_instances")
    .select("*")
    .eq("id", instanceId)
    .maybeSingle();
  if (instErr) {
    throw new WorkflowRepositoryError(
      "loadInstanceDetailForSync instance lookup failed",
      instErr,
    );
  }
  if (!instanceRow) {
    throw new WorkflowRepositoryError(
      `loadInstanceDetailForSync: unknown instance_id "${instanceId}"`,
    );
  }
  const instance = mapInstance(instanceRow as WorkflowInstanceRow);

  const [{ data: tplRow, error: tplErr }, { data: taskRows, error: tasksErr }] =
    await Promise.all([
      client
        .from("workflow_templates")
        .select("*")
        .eq("id", instance.templateId)
        .maybeSingle(),
      client
        .from("workflow_tasks")
        .select("*")
        .eq("instance_id", instanceId)
        .order("created_at", { ascending: true }),
    ]);
  if (tplErr) {
    throw new WorkflowRepositoryError(
      "loadInstanceDetailForSync template lookup failed",
      tplErr,
    );
  }
  if (!tplRow) {
    throw new WorkflowRepositoryError(
      `loadInstanceDetailForSync: template "${instance.templateId}" missing`,
    );
  }
  if (tasksErr) {
    throw new WorkflowRepositoryError(
      "loadInstanceDetailForSync tasks lookup failed",
      tasksErr,
    );
  }
  const template = mapTemplate(tplRow as WorkflowTemplateRow);
  const tasks = (taskRows ?? []).map((row) => mapTask(row as WorkflowTaskRow));
  const taskIO = await loadInstanceTaskIO(client, tasks);
  return { template, instance, tasks, taskIO };
}

/**
 * Walk the given task rows, rewriting `inputs[].upstreamTaskRef` from any
 * known *template* task id to the corresponding instance task id. Used by
 * `applyTemplateSync` after newly-added cells and updated cells are
 * persisted. Same shape as the post-insert remap in `createInstance`.
 *
 * Every `WorkflowInput` is now an upstream-output reference (no more
 * link-mode discriminator); the remap simply translates the task pointer
 * when one was snapshotted from the template.
 */
async function remapUpstreamRefs(
  client: SupabaseClient,
  rows: WorkflowTaskRow[],
  templateIdToInstanceId: Map<string, string>,
): Promise<void> {
  if (rows.length === 0 || templateIdToInstanceId.size === 0) return;
  for (const row of rows) {
    const normalized = normalizeInputs(row.inputs);
    let changed = false;
    const remapped = normalized.map((input) => {
      if (
        input.upstreamTaskRef &&
        templateIdToInstanceId.has(input.upstreamTaskRef)
      ) {
        const next = templateIdToInstanceId.get(input.upstreamTaskRef) as string;
        if (next !== input.upstreamTaskRef) {
          changed = true;
          return { ...input, upstreamTaskRef: next };
        }
      }
      return input;
    });
    if (!changed) continue;
    const { error } = await client
      .from("workflow_tasks")
      .update({ inputs: inputsToJsonb(remapped) })
      .eq("id", row.id);
    if (error) {
      throw new WorkflowRepositoryError(
        "remapUpstreamRefs failed",
        error,
      );
    }
  }
}

function unwrap<T>(label: string, data: T | null, error: unknown): T {
  if (error) {
    throw new WorkflowRepositoryError(`${label} failed`, error);
  }
  if (data === null || data === undefined) {
    throw new WorkflowRepositoryError(`${label} returned no row`);
  }
  return data;
}

export function createWorkflowRepository(
  client: SupabaseClient,
): WorkflowRepository {
  const repo: WorkflowRepository = {
    async getTemplates(): Promise<WorkflowTemplate[]> {
      const { data, error } = await client
        .from("workflow_templates")
        .select("*")
        .order("label", { ascending: true });

      if (error) {
        throw new WorkflowRepositoryError("getTemplates failed", error);
      }
      return (data ?? []).map((row) => mapTemplate(row as WorkflowTemplateRow));
    },

    async getTemplate(id: string): Promise<WorkflowTemplate | null> {
      const { data, error } = await client
        .from("workflow_templates")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (error) {
        throw new WorkflowRepositoryError("getTemplate failed", error);
      }
      if (!data) return null;
      return mapTemplate(data as WorkflowTemplateRow);
    },

    async getInstance(id: string): Promise<WorkflowInstanceDetail | null> {
      const { data: instanceRow, error: instanceErr } = await client
        .from("workflow_instances")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (instanceErr) {
        throw new WorkflowRepositoryError("getInstance failed", instanceErr);
      }
      if (!instanceRow) {
        return null;
      }

      const [{ data: taskRows, error: tasksErr }, { data: eventRows, error: eventsErr }] =
        await Promise.all([
          client
            .from("workflow_tasks")
            .select("*")
            .eq("instance_id", id)
            .order("created_at", { ascending: true }),
          client
            .from("workflow_events")
            .select("*")
            .eq("instance_id", id)
            .order("created_at", { ascending: false })
            .limit(50),
        ]);

      if (tasksErr) {
        throw new WorkflowRepositoryError("getInstance tasks failed", tasksErr);
      }
      if (eventsErr) {
        throw new WorkflowRepositoryError("getInstance events failed", eventsErr);
      }

      const tasks = (taskRows ?? []).map((row) => mapTask(row as WorkflowTaskRow));
      const taskIO = await loadInstanceTaskIO(client, tasks);

      return {
        ...mapInstance(instanceRow as WorkflowInstanceRow),
        tasks,
        events: (eventRows ?? []).map((row) => mapEvent(row as WorkflowEventRow)),
        taskIO,
      };
    },

    async getTask(taskId: string): Promise<WorkflowTask | null> {
      const { data, error } = await client
        .from("workflow_tasks")
        .select("*")
        .eq("id", taskId)
        .maybeSingle();

      if (error) {
        throw new WorkflowRepositoryError("getTask failed", error);
      }
      if (!data) {
        return null;
      }
      return mapTask(data as WorkflowTaskRow);
    },

    async transitionPendingCheckpoint(
      taskId: string,
      nextStatus: WorkflowCheckpointTransitionStatus,
    ): Promise<WorkflowTask | null> {
      // Approve resumes the task (clears the pause); reject leaves it
      // failed for the matrix glow to surface. Both clear paused_* so the
      // banner does not linger after the human decision.
      const { data, error } = await client
        .from("workflow_tasks")
        .update({
          status: nextStatus,
          paused_reason: null,
          paused_by: null,
          paused_at: null,
        })
        .eq("id", taskId)
        .eq("checkpoint", true)
        .eq("status", "paused")
        .eq("paused_reason", "checkpoint")
        .select("*")
        .maybeSingle();

      if (error) {
        throw new WorkflowRepositoryError(
          "transitionPendingCheckpoint failed",
          error,
        );
      }
      if (!data) {
        return null;
      }
      return mapTask(data as WorkflowTaskRow);
    },

    async listInstances(templateId?: string): Promise<WorkflowInstance[]> {
      let query = client
        .from("workflow_instances")
        .select("*")
        .order("created_at", { ascending: false });

      if (templateId) {
        query = query.eq("template_id", templateId);
      }

      const { data, error } = await query;
      if (error) {
        throw new WorkflowRepositoryError("listInstances failed", error);
      }
      return (data ?? []).map((row) => mapInstance(row as WorkflowInstanceRow));
    },

    async listAllTasks(): Promise<WorkflowTask[]> {
      const { data, error } = await client
        .from("workflow_tasks")
        .select("*")
        .order("created_at", { ascending: true });

      if (error) {
        throw new WorkflowRepositoryError("listAllTasks failed", error);
      }
      return (data ?? []).map((row) => mapTask(row as WorkflowTaskRow));
    },

    async listRecentEvents(limit: number): Promise<WorkflowEvent[]> {
      const normalizedLimit = Number.isFinite(limit) ? Math.trunc(limit) : 0;
      const safeLimit = Math.max(0, Math.min(normalizedLimit, 200));
      if (safeLimit === 0) return [];

      const { data, error } = await client
        .from("workflow_events")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(safeLimit);

      if (error) {
        throw new WorkflowRepositoryError("listRecentEvents failed", error);
      }
      return (data ?? []).map((row) => mapEvent(row as WorkflowEventRow));
    },

    async createInstance(
      templateId: string,
      label: string,
    ): Promise<WorkflowInstanceDetail> {
      const { data: tplRow, error: tplErr } = await client
        .from("workflow_templates")
        .select("*")
        .eq("id", templateId)
        .maybeSingle();

      if (tplErr) {
        throw new WorkflowRepositoryError("createInstance template lookup failed", tplErr);
      }
      if (!tplRow) {
        throw new WorkflowRepositoryError(
          `createInstance: unknown template_id "${templateId}"`,
        );
      }
      const template = mapTemplate(tplRow as WorkflowTemplateRow);

      const createdAtIso = new Date().toISOString();
      const { data: insertedInstance, error: insertErr } = await client
        .from("workflow_instances")
        .insert({
          template_id: template.id,
          label,
          status: "active",
          stages: template.stages,
          skills: template.skills as unknown as WorkflowSkill[],
          // Fresh instance is in sync with the template by construction.
          template_synced_at: createdAtIso,
        })
        .select("*")
        .single();

      const instance = mapInstance(
        unwrap("createInstance insert", insertedInstance, insertErr) as WorkflowInstanceRow,
      );

      let tasks: WorkflowTask[] = [];
      if (template.taskTemplates.length > 0) {
        const taskRowsToInsert = template.taskTemplates.map(
          (tpl: WorkflowTaskTemplate) => ({
            instance_id: instance.id,
            skill_id: tpl.skillId,
            stage_id: tpl.stageId,
            notes: tpl.notes ?? "",
            status: "not_started" as const,
            substatus: "",
            checkpoint: tpl.checkpoint ?? false,
            inputs: inputsToJsonb(tpl.inputs ?? []),
            outputs: outputsToJsonb(tpl.outputs ?? []),
            playbook_id: tpl.playbookId ?? null,
            owners: tpl.owners ?? [],
            template_task_id: tpl.id ?? null,
          }),
        );

        const { data: insertedTasks, error: tasksErr } = await client
          .from("workflow_tasks")
          .insert(taskRowsToInsert)
          .select("*");

        if (tasksErr) {
          throw new WorkflowRepositoryError(
            "createInstance tasks insert failed",
            tasksErr,
          );
        }
        const insertedRows = (insertedTasks ?? []) as WorkflowTaskRow[];

        // Wiring refs in template JSONB point at *template* task ids; the
        // instance materializes with fresh task uuids, so any
        // `inputs[].upstreamTaskRef` set in the template needs to be
        // re-pointed at the corresponding instance task. We now key the
        // remap on `template_task_id` directly (rename-proof; future-proof
        // if the editor ever allows multiple cards per cell). The
        // auto-satisfy trigger keys off `upstreamOutputId` so it works
        // regardless, but any UI that resolves the upstream task by id
        // (the wiring SVG, future graph views) depends on this remap.
        const templateIdToInstanceId = new Map<string, string>();
        for (const row of insertedRows) {
          if (row.template_task_id) {
            templateIdToInstanceId.set(row.template_task_id, row.id);
          }
        }

        const updates: { id: string; inputs: unknown[] }[] = [];
        for (const row of insertedRows) {
          const normalized = normalizeInputs(row.inputs);
          let changed = false;
          const remapped = normalized.map((input) => {
            if (
              input.upstreamTaskRef &&
              templateIdToInstanceId.has(input.upstreamTaskRef)
            ) {
              const next = templateIdToInstanceId.get(input.upstreamTaskRef) as string;
              if (next !== input.upstreamTaskRef) {
                changed = true;
                return { ...input, upstreamTaskRef: next };
              }
            }
            return input;
          });
          if (changed) {
            updates.push({ id: row.id, inputs: inputsToJsonb(remapped) });
          }
        }

        if (updates.length > 0) {
          await Promise.all(
            updates.map(async (update) => {
              const { error: updErr } = await client
                .from("workflow_tasks")
                .update({ inputs: update.inputs })
                .eq("id", update.id);
              if (updErr) {
                throw new WorkflowRepositoryError(
                  "createInstance ref remap failed",
                  updErr,
                );
              }
              const target = insertedRows.find((row) => row.id === update.id);
              if (target) target.inputs = update.inputs;
            }),
          );
        }

        tasks = insertedRows.map((row) => mapTask(row));
      }

      const taskIO = await loadInstanceTaskIO(client, tasks);
      return { ...instance, tasks, events: [], taskIO };
    },

    async updateInstance(
      instanceId: string,
      patch: Partial<Pick<WorkflowInstance, "label" | "status">>,
    ): Promise<WorkflowInstance> {
      const row: Record<string, unknown> = {};
      if (patch.label !== undefined) row.label = patch.label;
      if (patch.status !== undefined) row.status = patch.status;
      if (Object.keys(row).length === 0) {
        throw new WorkflowRepositoryError("updateInstance called with empty patch");
      }

      const { data, error } = await client
        .from("workflow_instances")
        .update(row)
        .eq("id", instanceId)
        .select("*")
        .single();

      return mapInstance(unwrap("updateInstance", data, error) as WorkflowInstanceRow);
    },

    async createTask(input: WorkflowTaskCreateInput): Promise<WorkflowTask> {
      const { data, error } = await client
        .from("workflow_tasks")
        .insert({
          instance_id: input.instanceId,
          skill_id: input.skillId,
          stage_id: input.stageId,
          notes: input.notes ?? "",
          status: "not_started",
          substatus: "",
          checkpoint: input.checkpoint ?? false,
          inputs: inputsToJsonb(input.inputs ?? []),
          outputs: outputsToJsonb(input.outputs ?? []),
          playbook_id: input.playbookId ?? null,
          owners: input.owners ?? [],
        })
        .select("*")
        .single();

      return mapTask(unwrap("createTask", data, error) as WorkflowTaskRow);
    },

    async updateTaskIfStatus(
      taskId: string,
      expectedStatus: WorkflowTaskStatus,
      patch: WorkflowTaskPatch,
    ): Promise<WorkflowTask | null> {
      const row = patchToRow(patch);
      if (Object.keys(row).length === 0) {
        throw new WorkflowRepositoryError("updateTaskIfStatus called with empty patch");
      }

      const { data, error } = await client
        .from("workflow_tasks")
        .update(row)
        .eq("id", taskId)
        .eq("status", expectedStatus)
        .select("*")
        .maybeSingle();

      if (error) {
        throw new WorkflowRepositoryError("updateTaskIfStatus failed", error);
      }
      if (!data) {
        return null;
      }
      return mapTask(data as WorkflowTaskRow);
    },

    async updateTask(taskId: string, patch: WorkflowTaskPatch): Promise<WorkflowTask> {
      const row = patchToRow(patch);
      if (Object.keys(row).length === 0) {
        throw new WorkflowRepositoryError("updateTask called with empty patch");
      }

      const { data, error } = await client
        .from("workflow_tasks")
        .update(row)
        .eq("id", taskId)
        .select("*")
        .single();

      return mapTask(unwrap("updateTask", data, error) as WorkflowTaskRow);
    },

    async deleteTask(taskId: string): Promise<void> {
      const { data, error } = await client
        .from("workflow_tasks")
        .delete()
        .eq("id", taskId)
        .select("*")
        .maybeSingle();

      if (error) {
        throw new WorkflowRepositoryError("deleteTask failed", error);
      }
      if (!data) {
        throw new WorkflowRepositoryError("deleteTask returned no row");
      }
    },

    async deleteInstance(instanceId: string): Promise<void> {
      const { data, error } = await client
        .from("workflow_instances")
        .delete()
        .eq("id", instanceId)
        .select("*")
        .maybeSingle();

      if (error) {
        throw new WorkflowRepositoryError("deleteInstance failed", error);
      }
      if (!data) {
        throw new WorkflowRepositoryError("deleteInstance returned no row");
      }
    },

    async createTemplate(label: string, color: string): Promise<WorkflowTemplate> {
      const slug = label
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 40) || "template";
      const id = `tpl-${slug}-${Math.random().toString(36).slice(2, 8)}`;

      const { data, error } = await client
        .from("workflow_templates")
        .insert({
          id,
          label,
          color,
          multi_instance: true,
          stages: [],
          skills: [],
          task_templates: [],
        })
        .select("*")
        .single();

      return mapTemplate(
        unwrap("createTemplate", data, error) as WorkflowTemplateRow,
      );
    },

    async updateTemplate(
      templateId: string,
      patch: WorkflowTemplatePatch,
    ): Promise<WorkflowTemplate> {
      const row = templatePatchToRow(patch);
      if (Object.keys(row).length === 0) {
        throw new WorkflowRepositoryError("updateTemplate called with empty patch");
      }

      const { data, error } = await client
        .from("workflow_templates")
        .update(row)
        .eq("id", templateId)
        .select("*")
        .single();

      return mapTemplate(
        unwrap("updateTemplate", data, error) as WorkflowTemplateRow,
      );
    },

    async deleteTemplate(templateId: string): Promise<void> {
      const { error: deleteInstancesError } = await client
        .from("workflow_instances")
        .delete()
        .eq("template_id", templateId);

      if (deleteInstancesError) {
        throw new WorkflowRepositoryError(
          "deleteTemplate instances cleanup failed",
          deleteInstancesError,
        );
      }

      const { error } = await client
        .from("workflow_templates")
        .delete()
        .eq("id", templateId);

      if (error) {
        throw new WorkflowRepositoryError("deleteTemplate failed", error);
      }
    },

    async addEvent(taskId: string, event: WorkflowEventInput): Promise<WorkflowEvent> {
      const { data: taskRow, error: taskErr } = await client
        .from("workflow_tasks")
        .select("instance_id")
        .eq("id", taskId)
        .single();

      if (taskErr || !taskRow) {
        throw new WorkflowRepositoryError("addEvent task lookup failed", taskErr);
      }

      const { data, error } = await client
        .from("workflow_events")
        .insert({
          instance_id: (taskRow as { instance_id: string }).instance_id,
          task_id: taskId,
          name: event.name,
          description: event.description ?? "",
          payload: event.payload ?? {},
        })
        .select("*")
        .single();

      return mapEvent(unwrap("addEvent", data, error) as WorkflowEventRow);
    },

    async addInstanceEvent(
      instanceId: string,
      event: WorkflowEventInput & { taskId?: string | null },
    ): Promise<WorkflowEvent> {
      const { data, error } = await client
        .from("workflow_events")
        .insert({
          instance_id: instanceId,
          task_id: event.taskId ?? null,
          name: event.name,
          description: event.description ?? "",
          payload: event.payload ?? {},
        })
        .select("*")
        .single();

      return mapEvent(unwrap("addInstanceEvent", data, error) as WorkflowEventRow);
    },

    async getDrawerData(taskId: string): Promise<DrawerData | null> {
      const { data: taskRow, error: taskErr } = await client
        .from("workflow_tasks")
        .select("*")
        .eq("id", taskId)
        .maybeSingle();

      if (taskErr) {
        throw new WorkflowRepositoryError("getDrawerData task failed", taskErr);
      }
      if (!taskRow) return null;
      const task = mapTask(taskRow as WorkflowTaskRow);

      const [inputsRes, outputsRes] = await Promise.all([
        client
          .from("task_inputs")
          .select("*")
          .eq("task_id", taskId)
          .order("input_id", { ascending: true }),
        client
          .from("task_outputs")
          .select("*")
          .eq("task_id", taskId)
          .order("created_at", { ascending: true }),
      ]);

      if (inputsRes.error) {
        throw new WorkflowRepositoryError("getDrawerData inputs failed", inputsRes.error);
      }
      if (outputsRes.error) {
        throw new WorkflowRepositoryError("getDrawerData outputs failed", outputsRes.error);
      }

      // Per-task snapshot is the source of truth. Fall back to the live
      // playbook_outputs only when the snapshot is empty AND the task is
      // wired to a playbook — covers any rows authored before the snapshot
      // backfill (or manual SQL inserts that skip outputs).
      let playbookOutputs: PlaybookOutput[] = task.outputs;
      if (playbookOutputs.length === 0 && task.playbookId) {
        const { data: poRows, error: poErr } = await client
          .from("playbook_outputs")
          .select("*")
          .eq("playbook_id", task.playbookId)
          .order("position", { ascending: true });
        if (poErr) {
          throw new WorkflowRepositoryError("getDrawerData playbook_outputs failed", poErr);
        }
        playbookOutputs = (poRows ?? []).map((row) =>
          mapPlaybookOutput(row as PlaybookOutputRow),
        );
      }

      return {
        task,
        inputs: (inputsRes.data ?? []).map((row) => mapTaskInput(row as TaskInputRow)),
        outputs: (outputsRes.data ?? []).map((row) => mapTaskOutput(row as TaskOutputRow)),
        playbookOutputs,
      };
    },

    async markInputReceived(taskId: string, inputId: string): Promise<TaskInputState> {
      const { data, error } = await client
        .from("task_inputs")
        .upsert(
          {
            task_id: taskId,
            input_id: inputId,
            received: true,
            received_at: new Date().toISOString(),
            received_from: null,
          },
          { onConflict: "task_id,input_id" },
        )
        .select("*")
        .single();

      return mapTaskInput(unwrap("markInputReceived", data, error) as TaskInputRow);
    },

    async bypassInput(taskId: string, inputId: string): Promise<TaskInputState> {
      // Same shape as markInputReceived but kept as a separate method so the
      // audit trail (events) can distinguish manual receipt from a skip.
      const { data, error } = await client
        .from("task_inputs")
        .upsert(
          {
            task_id: taskId,
            input_id: inputId,
            received: true,
            received_at: new Date().toISOString(),
            received_from: null,
          },
          { onConflict: "task_id,input_id" },
        )
        .select("*")
        .single();

      return mapTaskInput(unwrap("bypassInput", data, error) as TaskInputRow);
    },

    async produceOutput(
      taskId: string,
      outputId: string,
      artifact?: OutputArtifact,
    ): Promise<TaskOutput> {
      const { data, error } = await client
        .from("task_outputs")
        .upsert(
          {
            task_id: taskId,
            output_id: outputId,
            status: "produced",
            artifact_url: artifact?.artifactUrl ?? null,
            artifact_meta: artifact?.artifactMeta ?? null,
            produced_by: artifact?.producedBy ?? null,
            produced_at: new Date().toISOString(),
          },
          { onConflict: "task_id,output_id" },
        )
        .select("*")
        .single();

      return mapTaskOutput(unwrap("produceOutput", data, error) as TaskOutputRow);
    },

    async listOutputsForTemplate(
      templateId: string,
    ): Promise<TemplateOutputGroup[]> {
      const { data: templateRow, error: templateErr } = await client
        .from("workflow_templates")
        .select("task_templates")
        .eq("id", templateId)
        .maybeSingle();
      if (templateErr) {
        throw new WorkflowRepositoryError(
          "listOutputsForTemplate template lookup failed",
          templateErr,
        );
      }
      if (!templateRow) return [];

      const taskTemplates = toJsonArray<{
        playbookId?: unknown;
        outputs?: unknown;
      }>((templateRow as { task_templates: unknown }).task_templates);

      // Per-template-task snapshots are the source of truth. Group by
      // playbookId; if multiple tasks share a playbook (rare), union by id.
      const snapshotByPlaybook = new Map<string, Map<string, PlaybookOutput>>();
      const playbookIdsNeedingFallback = new Set<string>();
      const allPlaybookIds = new Set<string>();
      for (const task of taskTemplates) {
        const playbookId =
          typeof task.playbookId === "string" && task.playbookId.trim()
            ? task.playbookId.trim()
            : null;
        if (!playbookId) continue;
        allPlaybookIds.add(playbookId);
        const snapshot = normalizeOutputsSnapshot(task.outputs);
        if (snapshot.length === 0) {
          playbookIdsNeedingFallback.add(playbookId);
          continue;
        }
        const bucket = snapshotByPlaybook.get(playbookId) ?? new Map<string, PlaybookOutput>();
        for (const output of snapshot) {
          if (!bucket.has(output.id)) bucket.set(output.id, output);
        }
        snapshotByPlaybook.set(playbookId, bucket);
      }
      if (allPlaybookIds.size === 0) return [];
      const playbookIds = Array.from(allPlaybookIds);
      const fallbackIds = Array.from(playbookIdsNeedingFallback);

      const [{ data: itemRows, error: itemErr }, fallbackRes] = await Promise.all([
        client
          .from("framework_items")
          .select("id,name")
          .in("id", playbookIds)
          .eq("type", "playbook"),
        fallbackIds.length > 0
          ? client
              .from("playbook_outputs")
              .select("*")
              .in("playbook_id", fallbackIds)
              .order("position", { ascending: true })
          : Promise.resolve({ data: [], error: null } as const),
      ]);
      if (itemErr) {
        throw new WorkflowRepositoryError(
          "listOutputsForTemplate framework_items lookup failed",
          itemErr,
        );
      }
      if (fallbackRes.error) {
        throw new WorkflowRepositoryError(
          "listOutputsForTemplate playbook_outputs lookup failed",
          fallbackRes.error,
        );
      }

      const nameById = new Map<string, string>();
      for (const row of (itemRows ?? []) as { id: string; name: string }[]) {
        nameById.set(row.id, row.name);
      }
      for (const row of (fallbackRes.data ?? []) as PlaybookOutputRow[]) {
        const bucket =
          snapshotByPlaybook.get(row.playbook_id) ?? new Map<string, PlaybookOutput>();
        bucket.set(row.id, mapPlaybookOutput(row));
        snapshotByPlaybook.set(row.playbook_id, bucket);
      }

      return playbookIds
        .filter((id) => nameById.has(id))
        .map((id) => ({
          playbookId: id,
          playbookName: nameById.get(id) as string,
          outputs: Array.from(snapshotByPlaybook.get(id)?.values() ?? []).sort(
            (a, b) => a.position - b.position,
          ),
        }))
        .sort((a, b) =>
          a.playbookName.localeCompare(b.playbookName, undefined, {
            sensitivity: "base",
          }),
        );
    },

    async listPlaybookOutputs(playbookId: string): Promise<PlaybookOutput[]> {
      const { data, error } = await client
        .from("playbook_outputs")
        .select("*")
        .eq("playbook_id", playbookId)
        .order("position", { ascending: true });
      if (error) {
        throw new WorkflowRepositoryError("listPlaybookOutputs failed", error);
      }
      return (data ?? []).map((row) => mapPlaybookOutput(row as PlaybookOutputRow));
    },

    async createPlaybookOutput(input: {
      playbookId: string;
      name: string;
      description?: string | null;
      kind: PlaybookOutputKind;
      apiCheck?: Record<string, unknown> | null;
      position?: number;
    }): Promise<PlaybookOutput> {
      let position = input.position;
      if (position === undefined) {
        const { data: existing, error: posErr } = await client
          .from("playbook_outputs")
          .select("position")
          .eq("playbook_id", input.playbookId)
          .order("position", { ascending: false })
          .limit(1);
        if (posErr) {
          throw new WorkflowRepositoryError(
            "createPlaybookOutput position lookup failed",
            posErr,
          );
        }
        const maxRow = (existing ?? [])[0] as { position?: number } | undefined;
        position = (maxRow?.position ?? -1) + 1;
      }

      const { data, error } = await client
        .from("playbook_outputs")
        .insert({
          playbook_id: input.playbookId,
          name: input.name,
          description: input.description ?? null,
          kind: input.kind,
          api_check: input.apiCheck ?? null,
          position,
        })
        .select("*")
        .single();

      if (error) {
        if (isUniqueViolation(error)) {
          throw new WorkflowRepositoryError(
            "createPlaybookOutput name already exists",
            error,
            { code: "unique_name" },
          );
        }
        throw new WorkflowRepositoryError("createPlaybookOutput failed", error);
      }
      return mapPlaybookOutput(unwrap("createPlaybookOutput", data, null) as PlaybookOutputRow);
    },

    async updatePlaybookOutput(
      id: string,
      patch: Partial<{
        name: string;
        description: string | null;
        kind: PlaybookOutputKind | null;
        apiCheck: Record<string, unknown> | null;
        position: number;
      }>,
    ): Promise<PlaybookOutput> {
      const dbPatch: Record<string, unknown> = {};
      if (patch.name !== undefined) dbPatch.name = patch.name;
      if (patch.description !== undefined) dbPatch.description = patch.description;
      if (patch.kind !== undefined) dbPatch.kind = patch.kind;
      if (patch.apiCheck !== undefined) dbPatch.api_check = patch.apiCheck;
      if (patch.position !== undefined) dbPatch.position = patch.position;

      if (Object.keys(dbPatch).length === 0) {
        throw new WorkflowRepositoryError("updatePlaybookOutput: empty patch");
      }

      const { data, error } = await client
        .from("playbook_outputs")
        .update(dbPatch)
        .eq("id", id)
        .select("*")
        .single();

      if (error) {
        if (isUniqueViolation(error)) {
          throw new WorkflowRepositoryError(
            "updatePlaybookOutput name already exists",
            error,
            { code: "unique_name" },
          );
        }
        throw new WorkflowRepositoryError("updatePlaybookOutput failed", error);
      }
      return mapPlaybookOutput(unwrap("updatePlaybookOutput", data, null) as PlaybookOutputRow);
    },

    async deletePlaybookOutput(id: string): Promise<void> {
      const { error } = await client.from("playbook_outputs").delete().eq("id", id);
      if (error) {
        throw new WorkflowRepositoryError("deletePlaybookOutput failed", error);
      }
    },

    async reorderPlaybookOutputs(
      playbookId: string,
      orderedIds: string[],
    ): Promise<void> {
      if (orderedIds.length === 0) return;

      // Resolve which ids still exist for this playbook so we don't recreate
      // rows that were deleted between the editor's fetch and this call.
      const { data: existing, error: fetchErr } = await client
        .from("playbook_outputs")
        .select("id")
        .eq("playbook_id", playbookId)
        .in("id", orderedIds);
      if (fetchErr) {
        throw new WorkflowRepositoryError("reorderPlaybookOutputs fetch failed", fetchErr);
      }
      const valid = new Set((existing ?? []).map((row: { id: string }) => row.id));
      const updates = orderedIds
        .filter((id) => valid.has(id))
        .map((id, index) => ({ id, position: index }));
      if (updates.length === 0) return;

      // Per-row UPDATEs touch only the `position` column. An earlier upsert
      // approach tripped NOT NULL constraints on `name`/`playbook_id`
      // because PostgREST evaluates upserts as INSERT…ON CONFLICT, which
      // requires every NOT NULL column on the INSERT branch. N is small
      // (a handful of outputs per playbook) so we parallelize with
      // Promise.all to keep latency flat.
      const results = await Promise.all(
        updates.map(({ id, position }) =>
          client
            .from("playbook_outputs")
            .update({ position })
            .eq("id", id)
            .eq("playbook_id", playbookId),
        ),
      );
      const error = results.find((r) => r.error)?.error;
      if (error) {
        throw new WorkflowRepositoryError("reorderPlaybookOutputs failed", error);
      }
    },

    async listPlaybookInputs(playbookId: string): Promise<PlaybookInput[]> {
      const { data, error } = await client
        .from("playbook_inputs")
        .select("*")
        .eq("playbook_id", playbookId)
        .order("position", { ascending: true });
      if (error) {
        throw new WorkflowRepositoryError("listPlaybookInputs failed", error);
      }
      const rows = (data ?? []) as PlaybookInputRow[];
      return hydratePlaybookInputs(client, rows);
    },

    async createPlaybookInput(input: {
      playbookId: string;
      upstreamOutputId: string;
      position?: number;
    }): Promise<PlaybookInput> {
      let position = input.position;
      if (position === undefined) {
        const { data: existing, error: posErr } = await client
          .from("playbook_inputs")
          .select("position")
          .eq("playbook_id", input.playbookId)
          .order("position", { ascending: false })
          .limit(1);
        if (posErr) {
          throw new WorkflowRepositoryError(
            "createPlaybookInput position lookup failed",
            posErr,
          );
        }
        const maxRow = (existing ?? [])[0] as { position?: number } | undefined;
        position = (maxRow?.position ?? -1) + 1;
      }

      const { data, error } = await client
        .from("playbook_inputs")
        .insert({
          playbook_id: input.playbookId,
          upstream_output_id: input.upstreamOutputId,
          position,
        })
        .select("*")
        .single();

      if (error) {
        if (isUniqueViolation(error)) {
          throw new WorkflowRepositoryError(
            "createPlaybookInput upstream already wired",
            error,
            { code: "unique_upstream" },
          );
        }
        throw new WorkflowRepositoryError("createPlaybookInput failed", error);
      }
      const row = unwrap("createPlaybookInput", data, null) as PlaybookInputRow;
      const hydrated = await hydratePlaybookInputs(client, [row]);
      return hydrated[0];
    },

    async deletePlaybookInput(id: string): Promise<void> {
      const { error } = await client.from("playbook_inputs").delete().eq("id", id);
      if (error) {
        throw new WorkflowRepositoryError("deletePlaybookInput failed", error);
      }
    },

    async reorderPlaybookInputs(
      playbookId: string,
      orderedIds: string[],
    ): Promise<void> {
      if (orderedIds.length === 0) return;

      const { data: existing, error: fetchErr } = await client
        .from("playbook_inputs")
        .select("id")
        .eq("playbook_id", playbookId)
        .in("id", orderedIds);
      if (fetchErr) {
        throw new WorkflowRepositoryError("reorderPlaybookInputs fetch failed", fetchErr);
      }
      const valid = new Set((existing ?? []).map((row: { id: string }) => row.id));
      const updates = orderedIds
        .filter((id) => valid.has(id))
        .map((id, index) => ({ id, position: index }));
      if (updates.length === 0) return;

      // Per-row UPDATEs touch only `position` — same NOT-NULL reason as
      // reorderPlaybookOutputs (PostgREST evaluates upserts as INSERT…ON
      // CONFLICT and would trip name/playbook_id NOT NULL).
      const results = await Promise.all(
        updates.map(({ id, position }) =>
          client
            .from("playbook_inputs")
            .update({ position })
            .eq("id", id)
            .eq("playbook_id", playbookId),
        ),
      );
      const error = results.find((r) => r.error)?.error;
      if (error) {
        throw new WorkflowRepositoryError("reorderPlaybookInputs failed", error);
      }
    },

    async listOutputGroupsForOtherPlaybooks(
      currentPlaybookId: string,
    ): Promise<TemplateOutputGroup[]> {
      const { data: outputRows, error: outErr } = await client
        .from("playbook_outputs")
        .select("*")
        .order("playbook_id", { ascending: true })
        .order("position", { ascending: true });
      if (outErr) {
        throw new WorkflowRepositoryError(
          "listOutputGroupsForOtherPlaybooks outputs lookup failed",
          outErr,
        );
      }
      const byPlaybook = new Map<string, PlaybookOutput[]>();
      for (const row of (outputRows ?? []) as PlaybookOutputRow[]) {
        if (row.playbook_id === currentPlaybookId) continue;
        const bucket = byPlaybook.get(row.playbook_id) ?? [];
        bucket.push(mapPlaybookOutput(row));
        byPlaybook.set(row.playbook_id, bucket);
      }
      const playbookIds = Array.from(byPlaybook.keys());
      if (playbookIds.length === 0) return [];

      const { data: itemRows, error: itemErr } = await client
        .from("framework_items")
        .select("id,name")
        .in("id", playbookIds)
        .eq("type", "playbook");
      if (itemErr) {
        throw new WorkflowRepositoryError(
          "listOutputGroupsForOtherPlaybooks playbooks lookup failed",
          itemErr,
        );
      }
      const nameById = new Map<string, string>();
      for (const row of (itemRows ?? []) as { id: string; name: string }[]) {
        nameById.set(row.id, row.name);
      }

      return playbookIds
        .filter((id) => nameById.has(id))
        .map((id) => ({
          playbookId: id,
          playbookName: nameById.get(id) as string,
          outputs: (byPlaybook.get(id) ?? []).sort(
            (a, b) => a.position - b.position,
          ),
        }))
        .sort((a, b) =>
          a.playbookName.localeCompare(b.playbookName, undefined, {
            sensitivity: "base",
          }),
        );
    },

    async countTaskOutputsForPlaybookOutput(outputId: string): Promise<number> {
      // We fetch ids rather than using `count: "exact", head: true` because
      // the editor only calls this once per delete-confirm and the row count
      // is bounded by the number of tasks pointing at the playbook (typically
      // single digits). Keeps the supabase fake in tests simple.
      const { data, error } = await client
        .from("task_outputs")
        .select("id")
        .eq("output_id", outputId);
      if (error) {
        throw new WorkflowRepositoryError(
          "countTaskOutputsForPlaybookOutput failed",
          error,
        );
      }
      return (data ?? []).length;
    },

    async pauseTask(
      taskId: string,
      reason: string,
      pausedBy?: string | null,
    ): Promise<WorkflowTask> {
      const trimmedReason = reason.trim();
      if (!trimmedReason) {
        throw new WorkflowRepositoryError("pauseTask: reason is required");
      }
      const { data, error } = await client
        .from("workflow_tasks")
        .update({
          status: "paused",
          paused_reason: trimmedReason,
          paused_by: pausedBy ?? null,
          paused_at: new Date().toISOString(),
        })
        .eq("id", taskId)
        .select("*")
        .single();

      return mapTask(unwrap("pauseTask", data, error) as WorkflowTaskRow);
    },

    async resumeTask(taskId: string): Promise<WorkflowTask> {
      // Resume sends the task back to in_progress and clears the pause
      // metadata. Callers (server actions) re-run deriveStatus afterwards
      // to pick up any inputs/outputs that changed during the pause.
      const { data, error } = await client
        .from("workflow_tasks")
        .update({
          status: "in_progress",
          paused_reason: null,
          paused_by: null,
          paused_at: null,
        })
        .eq("id", taskId)
        .select("*")
        .single();

      return mapTask(unwrap("resumeTask", data, error) as WorkflowTaskRow);
    },

    async getInstanceTemplateDiff(instanceId: string): Promise<InstanceTemplateDiff> {
      const detail = await loadInstanceDetailForSync(client, instanceId);
      return diffInstanceFromTemplate(
        detail.template,
        detail.instance,
        detail.tasks,
        detail.taskIO,
      );
    },

    async applyTemplateSync(
      instanceId: string,
      selection: TemplateSyncSelection,
    ): Promise<WorkflowInstanceDetail> {
      // Re-derive the diff server-side. The drawer's selection is just a
      // list of ids it would *like* applied; we ignore anything not in the
      // freshly computed diff (e.g. a stage already added by a concurrent
      // tab) and re-run the pristine check on tasks (status may have moved
      // off not_started between the drawer fetch and this call).
      const detail = await loadInstanceDetailForSync(client, instanceId);
      const diff = diffInstanceFromTemplate(
        detail.template,
        detail.instance,
        detail.tasks,
        detail.taskIO,
      );

      const applied: { kind: string; id: string }[] = [];

      // --- Stages: add + rename ---
      const stageIdsAddSet = new Set(selection.stageIdsToAdd);
      const stageIdsRenameSet = new Set(selection.stageIdsToRename);
      const stagesToAdd = diff.stages.added.filter((s) => stageIdsAddSet.has(s.id));
      const stagesToRename = diff.stages.renamed.filter((s) =>
        stageIdsRenameSet.has(s.id),
      );
      const nextStages: WorkflowStage[] = detail.instance.stages.map((s) => {
        const rename = stagesToRename.find((r) => r.id === s.id);
        if (rename) return { id: rename.to.id, label: rename.to.label, sub: rename.to.sub };
        return { id: s.id, label: s.label, sub: s.sub };
      });
      for (const s of stagesToAdd) {
        nextStages.push({ id: s.id, label: s.label, sub: s.sub });
        applied.push({ kind: "stage_add", id: s.id });
      }
      for (const r of stagesToRename) applied.push({ kind: "stage_rename", id: r.id });

      // --- Skills: add + rename ---
      const skillIdsAddSet = new Set(selection.skillIdsToAdd);
      const skillIdsRenameSet = new Set(selection.skillIdsToRename);
      const skillsToAdd = diff.skills.added.filter((s) => skillIdsAddSet.has(s.id));
      const skillsToRename = diff.skills.renamed.filter((s) =>
        skillIdsRenameSet.has(s.id),
      );
      const nextSkills: WorkflowSkill[] = detail.instance.skills.map((s) => {
        const rename = skillsToRename.find((r) => r.id === s.id);
        if (rename) return { id: rename.to.id, label: rename.to.label, owners: s.owners };
        return s;
      });
      for (const s of skillsToAdd) {
        nextSkills.push({ id: s.id, label: s.label, owners: s.owners ?? [] });
        applied.push({ kind: "skill_add", id: s.id });
      }
      for (const r of skillsToRename) applied.push({ kind: "skill_rename", id: r.id });

      const stageOrSkillChanged =
        stagesToAdd.length > 0 ||
        stagesToRename.length > 0 ||
        skillsToAdd.length > 0 ||
        skillsToRename.length > 0;

      if (stageOrSkillChanged) {
        const { error: instUpdErr } = await client
          .from("workflow_instances")
          .update({ stages: nextStages, skills: nextSkills })
          .eq("id", instanceId);
        if (instUpdErr) {
          throw new WorkflowRepositoryError(
            "applyTemplateSync stages/skills update failed",
            instUpdErr,
          );
        }
      }

      // --- Tasks: add new cells materialized from template_task_id ---
      // Build the lineage→instance id map up front because new tasks may
      // reference other tasks (existing or just-added) via
      // `inputs[].upstreamTaskRef`.
      const templateIdToInstanceId = new Map<string, string>();
      for (const task of detail.tasks) {
        if (task.templateTaskId) templateIdToInstanceId.set(task.templateTaskId, task.id);
      }

      const addIdsSet = new Set(selection.taskTemplateIdsToAdd);
      const tasksToAdd = diff.tasks.added.filter(
        (t) => t.id !== undefined && addIdsSet.has(t.id),
      );

      const newlyInsertedRows: WorkflowTaskRow[] = [];
      if (tasksToAdd.length > 0) {
        const rowsToInsert = tasksToAdd.map((tpl) => ({
          instance_id: instanceId,
          skill_id: tpl.skillId,
          stage_id: tpl.stageId,
          notes: tpl.notes ?? "",
          status: "not_started" as const,
          substatus: "",
          checkpoint: tpl.checkpoint ?? false,
          // Preserve template upstream refs verbatim; we remap them in a
          // second pass once we know the new instance task ids.
          inputs: inputsToJsonb(tpl.inputs ?? []),
          // Per-task outputs snapshot, same shape createInstance uses
          // (migration 20260515120000_workflow_task_outputs_snapshot.sql).
          outputs: outputsToJsonb(tpl.outputs ?? []),
          playbook_id: tpl.playbookId ?? null,
          owners: tpl.owners ?? [],
          template_task_id: tpl.id ?? null,
        }));
        const { data: insertedTasks, error: insertTasksErr } = await client
          .from("workflow_tasks")
          .insert(rowsToInsert)
          .select("*");
        if (insertTasksErr) {
          throw new WorkflowRepositoryError(
            "applyTemplateSync task insert failed",
            insertTasksErr,
          );
        }
        for (const row of (insertedTasks ?? []) as WorkflowTaskRow[]) {
          newlyInsertedRows.push(row);
          if (row.template_task_id) {
            templateIdToInstanceId.set(row.template_task_id, row.id);
          }
          applied.push({ kind: "task_add", id: row.id });
        }

        // Materialize task_inputs rows so deriveStatus can flip them from
        // waiting → not_started as upstream outputs land. Matches the
        // backfill pattern in 20260507120000_playbook_outputs_and_status.sql.
        const taskInputsRows: Record<string, unknown>[] = [];
        for (const row of newlyInsertedRows) {
          const inputs = normalizeInputs(row.inputs);
          for (const input of inputs) {
            taskInputsRows.push({
              task_id: row.id,
              input_id: input.id,
              received: false,
              received_at: null,
              received_from: null,
            });
          }
        }
        if (taskInputsRows.length > 0) {
          const { error: tiErr } = await client
            .from("task_inputs")
            .upsert(taskInputsRows, { onConflict: "task_id,input_id" });
          if (tiErr) {
            throw new WorkflowRepositoryError(
              "applyTemplateSync task_inputs materialize failed",
              tiErr,
            );
          }
        }
      }

      // --- Tasks: update existing pristine cells ---
      // Re-check the syncable flag against the freshly-computed diff. The
      // selection may carry instance task ids that have since moved off
      // not_started — those are dropped silently.
      const applicableUpdateIds = filterApplicableTaskUpdates(selection, diff);
      const updateIdSet = new Set(applicableUpdateIds);
      const updatesToApply = diff.tasks.changed.filter((c) =>
        updateIdSet.has(c.instanceTaskId),
      );

      for (const change of updatesToApply) {
        const tpl = detail.template.taskTemplates.find((t) => t.id === change.templateTaskId);
        if (!tpl) continue;
        // Re-check pristine inside the conditional update to close the race
        // between diff and apply.
        const rowPatch: Record<string, unknown> = {};
        if (change.fields.notes) rowPatch.notes = change.fields.notes.to;
        if (change.fields.playbookId) rowPatch.playbook_id = change.fields.playbookId.to;
        if (change.fields.checkpoint) {
          rowPatch.checkpoint = change.fields.checkpoint.to;
        }
        if (change.fields.owners) rowPatch.owners = change.fields.owners.to;
        if (change.fields.inputs) {
          rowPatch.inputs = inputsToJsonb(tpl.inputs ?? []);
        }
        if (Object.keys(rowPatch).length === 0) continue;
        const { data: updatedRow, error: taskUpdErr } = await client
          .from("workflow_tasks")
          .update(rowPatch)
          .eq("id", change.instanceTaskId)
          .eq("status", "not_started")
          .select("*")
          .maybeSingle();
        if (taskUpdErr) {
          throw new WorkflowRepositoryError(
            "applyTemplateSync task update failed",
            taskUpdErr,
          );
        }
        // updatedRow is null iff the conditional update missed (the task
        // was started between diff and apply). Drop silently — UI labels it
        // informational on the next refresh.
        if (!updatedRow) continue;
        applied.push({ kind: "task_update", id: change.instanceTaskId });

        // Reconcile task_inputs when the inputs array changed. The task is
        // guaranteed pristine here (status=not_started, no produced
        // outputs) so no `received_*` audit state can be lost: just wipe
        // and re-seed from the template's input list.
        if (change.fields.inputs) {
          const { error: delErr } = await client
            .from("task_inputs")
            .delete()
            .eq("task_id", change.instanceTaskId);
          if (delErr) {
            throw new WorkflowRepositoryError(
              "applyTemplateSync task_inputs wipe failed",
              delErr,
            );
          }
          const tiInsert = (tpl.inputs ?? []).map((input) => ({
            task_id: change.instanceTaskId,
            input_id: input.id,
            received: false,
            received_at: null,
            received_from: null,
          }));
          if (tiInsert.length > 0) {
            const { error: insErr } = await client
              .from("task_inputs")
              .insert(tiInsert);
            if (insErr) {
              throw new WorkflowRepositoryError(
                "applyTemplateSync task_inputs insert failed",
                insErr,
              );
            }
          }
        }
      }

      // --- Remap upstreamTaskRef on newly inserted + updated rows ---
      // After both adds and updates landed, any `inputs[].upstreamTaskRef`
      // still pointing at a *template* task id needs to be re-pointed at
      // the corresponding instance task id. Same pattern as createInstance.
      const rowsNeedingRemap: WorkflowTaskRow[] = [];
      rowsNeedingRemap.push(...newlyInsertedRows);
      if (updatesToApply.length > 0) {
        const { data: refreshed, error: refErr } = await client
          .from("workflow_tasks")
          .select("*")
          .in("id", updatesToApply.map((c) => c.instanceTaskId));
        if (refErr) {
          throw new WorkflowRepositoryError(
            "applyTemplateSync remap fetch failed",
            refErr,
          );
        }
        for (const row of (refreshed ?? []) as WorkflowTaskRow[]) {
          rowsNeedingRemap.push(row);
        }
      }
      await remapUpstreamRefs(client, rowsNeedingRemap, templateIdToInstanceId);

      // --- Bump template_synced_at + emit an event ---
      if (applied.length > 0) {
        const syncedAt = new Date().toISOString();
        const { error: stampErr } = await client
          .from("workflow_instances")
          .update({ template_synced_at: syncedAt })
          .eq("id", instanceId);
        if (stampErr) {
          throw new WorkflowRepositoryError(
            "applyTemplateSync stamp failed",
            stampErr,
          );
        }
        const { error: evErr } = await client
          .from("workflow_events")
          .insert({
            instance_id: instanceId,
            task_id: null,
            name: "template_sync_applied",
            description: `Applied ${applied.length} change${applied.length === 1 ? "" : "s"} from template`,
            payload: { applied },
          });
        if (evErr) {
          throw new WorkflowRepositoryError(
            "applyTemplateSync event insert failed",
            evErr,
          );
        }
      }

      const refreshed = await repo.getInstance(instanceId);
      if (!refreshed) {
        throw new WorkflowRepositoryError(
          "applyTemplateSync: instance vanished after apply",
        );
      }
      return refreshed;
    },

    async getTemplateMatrix(templateId: string): Promise<TemplateMatrix | null> {
      const { data: tplRow, error: tplErr } = await client
        .from("workflow_templates")
        .select("*")
        .eq("id", templateId)
        .maybeSingle();
      if (tplErr) {
        throw new WorkflowRepositoryError("getTemplateMatrix template lookup failed", tplErr);
      }
      if (!tplRow) return null;
      const template = mapTemplate(tplRow as WorkflowTemplateRow);

      const { data: instanceRows, error: instErr } = await client
        .from("workflow_instances")
        .select("*")
        .eq("template_id", templateId)
        .order("created_at", { ascending: true });
      if (instErr) {
        throw new WorkflowRepositoryError(
          "getTemplateMatrix instances lookup failed",
          instErr,
        );
      }
      const instances = (instanceRows ?? []).map((row) =>
        mapInstance(row as WorkflowInstanceRow),
      );

      if (instances.length === 0) {
        return {
          template,
          instances,
          cells: aggregateTasksByTemplateCell(template, instances, [], []),
        };
      }

      const instanceIds = instances.map((i) => i.id);
      const { data: taskRows, error: taskErr } = await client
        .from("workflow_tasks")
        .select("*")
        .in("instance_id", instanceIds);
      if (taskErr) {
        throw new WorkflowRepositoryError(
          "getTemplateMatrix tasks lookup failed",
          taskErr,
        );
      }
      const tasks = (taskRows ?? []).map((row) => mapTask(row as WorkflowTaskRow));
      const taskIO = await loadInstanceTaskIO(client, tasks);

      return {
        template,
        instances,
        cells: aggregateTasksByTemplateCell(template, instances, tasks, taskIO),
      };
    },

    async getFrameworkItems(type?: FrameworkItemType): Promise<FrameworkItem[]> {
      let query = client
        .from("framework_items")
        .select("*")
        .order("type", { ascending: true })
        .order("name", { ascending: true });

      if (type) {
        query = query.eq("type", type);
      }

      const { data, error } = await query;
      if (error) {
        throw new WorkflowRepositoryError("getFrameworkItems failed", error);
      }

      const rows = (data ?? []) as FrameworkItemRow[];

      // Bulk-fetch the allowed-skills join so we can project both directions
      // (skills allowed by a playbook, and the inverse: playbooks a skill
      // is allowed in) in a single round-trip.
      const playbookIds = rows.filter((r) => r.type === "playbook").map((r) => r.id);
      const skillIds = rows.filter((r) => r.type === "skill").map((r) => r.id);
      const allowedByPlaybook = new Map<string, string[]>();
      const allowedBySkill = new Map<string, string[]>();
      if (playbookIds.length > 0 || skillIds.length > 0) {
        let joinQuery = client
          .from("framework_item_allowed_skills")
          .select("playbook_id, skill_id");

        // Constrain to ids we actually returned. `or()` lets us union the
        // two sides; if one list is empty we fall back to the non-empty side.
        if (playbookIds.length > 0 && skillIds.length > 0) {
          joinQuery = joinQuery.or(
            `playbook_id.in.(${playbookIds.join(",")}),skill_id.in.(${skillIds.join(",")})`,
          );
        } else if (playbookIds.length > 0) {
          joinQuery = joinQuery.in("playbook_id", playbookIds);
        } else {
          joinQuery = joinQuery.in("skill_id", skillIds);
        }

        const { data: allowedRows, error: allowedErr } = await joinQuery;

        if (allowedErr) {
          throw new WorkflowRepositoryError(
            "getFrameworkItems allowed_skills failed",
            allowedErr,
          );
        }
        for (const row of (allowedRows ?? []) as AllowedSkillRow[]) {
          const skillList = allowedByPlaybook.get(row.playbook_id) ?? [];
          skillList.push(row.skill_id);
          allowedByPlaybook.set(row.playbook_id, skillList);

          const playbookList = allowedBySkill.get(row.skill_id) ?? [];
          playbookList.push(row.playbook_id);
          allowedBySkill.set(row.skill_id, playbookList);
        }
      }

      return rows.map((row) =>
        mapFrameworkItem(
          row,
          allowedByPlaybook.get(row.id) ?? [],
          allowedBySkill.get(row.id) ?? [],
        ),
      );
    },

    async upsertFrameworkItem(item: FrameworkItem): Promise<FrameworkItem> {
      const { data, error } = await client
        .from("framework_items")
        .upsert({
          id: item.id,
          type: item.type,
          name: item.name,
          description: item.description,
          icon: item.icon,
          color: item.color ?? null,
          content: item.content,
        })
        .select("*")
        .single();

      const saved = mapFrameworkItem(
        unwrap("upsertFrameworkItem", data, error) as FrameworkItemRow,
      );

      // Replace the allowed-skills relation only on the side the caller
      // actually provided — the join table is symmetric, so editing a
      // playbook owns the (playbook_id=self, *) projection and editing a
      // skill owns the (*, skill_id=self) projection. Skipping the replace
      // when the field is undefined ensures we never wipe rows authored
      // from the other side. Two statements (delete + insert) because
      // Supabase JS doesn't expose transactional batches — accept the
      // brief inconsistency window for V1 simplicity.
      if (saved.type === "playbook" && item.allowedSkillIds !== undefined) {
        // Dedupe — the PK (playbook_id, skill_id) would reject duplicates,
        // and the picker has no need to send them.
        const requested = Array.from(new Set(item.allowedSkillIds));
        // Drop IDs that no longer exist as skills. Stale references are a
        // real-world hazard (deleted skill, drafted-but-never-saved id, etc.)
        // and would otherwise surface as an opaque FK violation on insert.
        const desired = await filterExistingFrameworkItemIds(
          client,
          requested,
          "skill",
        );

        const { error: deleteErr } = await client
          .from("framework_item_allowed_skills")
          .delete()
          .eq("playbook_id", saved.id);
        if (deleteErr) {
          throw new WorkflowRepositoryError(
            "upsertFrameworkItem allowed_skills delete failed",
            deleteErr,
          );
        }

        if (desired.length > 0) {
          // Use upsert with ignoreDuplicates so a concurrent writer that
          // re-inserted a (playbook_id, skill_id) pair between our delete
          // and insert doesn't surface as a PK violation here.
          const { error: insertErr } = await client
            .from("framework_item_allowed_skills")
            .upsert(
              desired.map((skillId) => ({
                playbook_id: saved.id,
                skill_id: skillId,
              })),
              { onConflict: "playbook_id,skill_id", ignoreDuplicates: true },
            );
          if (insertErr) {
            throw new WorkflowRepositoryError(
              "upsertFrameworkItem allowed_skills insert failed",
              insertErr,
            );
          }
        }

        saved.allowedSkillIds = desired;
      } else if (saved.type === "skill" && item.allowedPlaybookIds !== undefined) {
        const requested = Array.from(new Set(item.allowedPlaybookIds));
        const desired = await filterExistingFrameworkItemIds(
          client,
          requested,
          "playbook",
        );

        const { error: deleteErr } = await client
          .from("framework_item_allowed_skills")
          .delete()
          .eq("skill_id", saved.id);
        if (deleteErr) {
          throw new WorkflowRepositoryError(
            "upsertFrameworkItem allowed_playbooks delete failed",
            deleteErr,
          );
        }

        if (desired.length > 0) {
          const { error: insertErr } = await client
            .from("framework_item_allowed_skills")
            .upsert(
              desired.map((playbookId) => ({
                playbook_id: playbookId,
                skill_id: saved.id,
              })),
              { onConflict: "playbook_id,skill_id", ignoreDuplicates: true },
            );
          if (insertErr) {
            throw new WorkflowRepositoryError(
              "upsertFrameworkItem allowed_playbooks insert failed",
              insertErr,
            );
          }
        }

        saved.allowedPlaybookIds = desired;
      }

      return saved;
    },

    async deleteFrameworkItem(itemId: string): Promise<void> {
      const { data, error } = await client
        .from("framework_items")
        .delete()
        .eq("id", itemId)
        .select("*")
        .maybeSingle();

      if (error) {
        throw new WorkflowRepositoryError("deleteFrameworkItem failed", error);
      }
      if (!data) {
        throw new WorkflowRepositoryError("deleteFrameworkItem returned no row");
      }
    },
  };
  return repo;
}
