// Shared workflow domain types. These mirror the SQL schema in
// `products/dashboard/supabase/migrations/` and the `workflow_repository`
// interface defined in `interfaces/interfaces.yaml`.

export type WorkflowInstanceStatus =
  | "not_started"
  | "active"
  | "blocked"
  | "complete";

/**
 * The 7-state design enum (PR 2 / AEL-60). `running` is the transient
 * sub-state of `in_progress` while an agent is actively executing. Render
 * code reads the persisted column; `deriveStatus()` is the single source
 * of truth for transitions on every server action that mutates task state.
 */
export type WorkflowTaskStatus =
  | "not_started"
  | "waiting"
  | "paused"
  | "in_progress"
  | "running"
  | "complete"
  | "failed";

/** Alias used by drawer/UI code that wants the explicit "status" name. */
export type TaskStatus = WorkflowTaskStatus;

/**
 * Legal terminal states for `WorkflowRepository.transitionPendingCheckpoint`.
 * Drawer-checkpoint approve resumes (status flips to `in_progress`); reject
 * surfaces as `failed` so the matrix glow lights up.
 */
export type WorkflowCheckpointTransitionStatus =
  | Extract<WorkflowTaskStatus, "in_progress">
  | Extract<WorkflowTaskStatus, "failed">;

export type FrameworkItemType = "skill" | "playbook";

export interface WorkflowStage {
  id: string;
  label: string;
  sub?: string;
}

/**
 * Matrix row. `id` is a `framework_items.id` of type 'skill'; `label` is
 * snapshotted from the framework item at the time the row was added so the
 * matrix renders even if the underlying skill is later renamed/deleted.
 */
export interface WorkflowSkill {
  id: string;
  label: string;
  /** One or more owner labels (people or AI agents). Required to be at
   *  least one in the editor; older rows that stored a single `owner`
   *  string get migrated to a one-element array on read in the repo. */
  owners: string[];
}

/**
 * A task's data-flow dependency. Every input is a reference to an upstream
 * `playbook_outputs.id`; there are no manual/bypass modes at definition
 * time. (Per-instance bypassing is still possible via the runtime
 * `bypassInput` server action, which flips `task_inputs.received=true`
 * with `received_from=null` — that's an instance state, not a definition.)
 *
 * `upstreamTaskRef` carries the *task id* of the upstream producer when
 * snapshotting into a template/instance, so the matrix wiring overlay can
 * draw the right arrows without re-resolving from upstream_output_id.
 */
export interface WorkflowInput {
  id: string;
  upstreamOutputId: string;
  upstreamTaskRef?: string;
}

export interface WorkflowTaskTemplate {
  id?: string;
  skillId: string;
  stageId: string;
  playbookId: string | null;
  notes?: string;
  checkpoint?: boolean;
  inputs?: WorkflowInput[];
  /** Snapshot of the playbook's outputs at attach time. Editing this list
   *  (remove, reorder) does not propagate back to the playbook definition;
   *  removing an output here just opts this template out of producing it.
   *  Snapshot ids equal the source `playbook_outputs.id` so produce-flow
   *  upserts on `(task_id, output_id)` continue to work. */
  outputs?: PlaybookOutput[];
  owners?: string[];
}

export interface WorkflowTemplate {
  id: string;
  label: string;
  /** Identity color for the template itself (surfaced in the editor header
   *  and template list chrome). Distinct from the per-row colors which
   *  derive from each linked Skill (`FrameworkItem.color`). */
  color: string;
  multiInstance: boolean;
  stages: WorkflowStage[];
  skills: WorkflowSkill[];
  taskTemplates: WorkflowTaskTemplate[];
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowTask {
  id: string;
  instanceId: string;
  skillId: string;
  stageId: string;
  notes: string;
  status: WorkflowTaskStatus;
  substatus: string;
  checkpoint: boolean;
  inputs: WorkflowInput[];
  /** Snapshot of the playbook's outputs at attach time — see
   *  `WorkflowTaskTemplate.outputs` for the lifecycle. Always-present array
   *  so callers don't have to null-check; backfill defaults to `[]` for any
   *  legacy task with no `playbookId`. */
  outputs: PlaybookOutput[];
  playbookId: string | null;
  /** Owner labels (people or AI agents) assigned to this specific card.
   *  Per-task so two cards pointing at the same playbook can carry different
   *  owners (e.g. different sales people across instances). */
  owners: string[];
  /** Lineage back to the `task_templates[].id` this task was materialized
   *  from. Null on ad-hoc instance tasks created via createTask, and on
   *  legacy rows authored before the lineage migration. Drives template-
   *  level rollup (aggregateTasksByTemplateCell) and the template sync
   *  diff. Optional in the type so older test fixtures stay valid. */
  templateTaskId?: string | null;
  /** Why the task is paused (e.g. `'checkpoint'`, `'awaiting_input'`).
   *  Drives the drawer pause banner; null when status !== 'paused'. */
  pausedReason?: string | null;
  pausedBy?: string | null;
  pausedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Outputs and per-task IO state (PR 2 / AEL-60). `PlaybookOutput` is the
// definition-level record stored on a Playbook; `TaskOutput` and
// `TaskInputState` are per-task-instance state that the drawer consumes.
// ---------------------------------------------------------------------------

export type PlaybookOutputKind = "file" | "media" | "link" | "manual" | "api";

export interface PlaybookOutput {
  id: string;
  playbookId: string;
  name: string;
  description?: string | null;
  kind: PlaybookOutputKind | null;
  apiCheck?: Record<string, unknown> | null;
  position: number;
  createdAt: string;
}

/**
 * Definition-level input declared on a Playbook. Always a reference to an
 * upstream output on *another* playbook — there is no free-form mode at
 * the playbook level. Snapshotted into `workflow_tasks.inputs[].upstreamOutputId`
 * when the playbook is attached to a template/instance.
 *
 * The repo hydrates display fields (`upstreamOutputName`, `upstreamPlaybookId`,
 * `upstreamPlaybookName`, `upstreamOutputKind`) on read so the dock and
 * drawer can render the "Playbook / Output" chip without joining a second
 * time.
 */
export interface PlaybookInput {
  id: string;
  playbookId: string;
  upstreamOutputId: string;
  position: number;
  createdAt: string;
  upstreamOutputName: string;
  upstreamOutputKind: PlaybookOutputKind | null;
  upstreamPlaybookId: string;
  upstreamPlaybookName: string;
}

/**
 * One entry per playbook attached to a template, returned by
 * `WorkflowRepository.listOutputsForTemplate`. `outputs` is sorted by
 * `position` ascending and may be empty when the playbook has no
 * declared outputs yet (the picker renders a "Declare an output" CTA).
 */
export interface TemplateOutputGroup {
  playbookId: string;
  playbookName: string;
  outputs: PlaybookOutput[];
}

export type TaskOutputStatus = "pending" | "produced" | "failed" | "skipped";

export interface TaskOutput {
  id: string;
  taskId: string;
  outputId: string;
  status: TaskOutputStatus;
  artifactUrl?: string | null;
  artifactMeta?: Record<string, unknown> | null;
  producedBy?: string | null;
  producedAt?: string | null;
  createdAt: string;
}

export interface TaskInputState {
  id: string;
  taskId: string;
  inputId: string;
  received: boolean;
  receivedAt?: string | null;
  receivedFrom?: string | null;
}

/**
 * Bundle returned by `WorkflowRepository.getDrawerData` so the drawer can
 * render with one round-trip: the task itself, its per-instance input/output
 * state, and the underlying playbook's output definitions.
 */
export interface DrawerData {
  task: WorkflowTask;
  inputs: TaskInputState[];
  outputs: TaskOutput[];
  playbookOutputs: PlaybookOutput[];
}

/** Optional artifact payload accepted by `produceOutputAction`. */
export interface OutputArtifact {
  artifactUrl?: string | null;
  artifactMeta?: Record<string, unknown> | null;
  producedBy?: string | null;
}

export interface WorkflowTaskCreateInput {
  instanceId: string;
  skillId: string;
  stageId: string;
  playbookId: string | null;
  notes?: string;
  checkpoint?: boolean;
  inputs?: WorkflowInput[];
  outputs?: PlaybookOutput[];
  owners?: string[];
}

export interface WorkflowEvent {
  id: string;
  instanceId: string;
  taskId: string | null;
  name: string;
  description: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface WorkflowInstance {
  id: string;
  templateId: string;
  label: string;
  status: WorkflowInstanceStatus;
  /** Snapshot of the template's stages at create time. Decoupled from the
   *  template so edits to the template do not mutate existing instances. */
  stages: WorkflowStage[];
  skills: WorkflowSkill[];
  /** Last time this instance was reconciled with its template via
   *  applyTemplateSync (set to createdAt for fresh instances). Drives the
   *  "Last synced" label in the sync drawer. Null on legacy rows that
   *  predate the lineage migration and have never been touched by sync.
   *  Optional in the type so older test fixtures stay valid. */
  templateSyncedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowInstanceDetail extends WorkflowInstance {
  tasks: WorkflowTask[];
  events: WorkflowEvent[];
  /** Per-task IO summary — outputs progress + unmet linked-input flag —
   *  batched into the instance fetch so the matrix can render pips/glyphs
   *  on every card without an additional round-trip per card. One entry per
   *  task in `tasks`; tasks with no declared outputs and no linked inputs
   *  still appear with empty `outputs` and `hasUnmetLinkedInput: false`. */
  taskIO: TaskIOSummary[];
}

/**
 * Compact IO state used by `TaskCard` to render the output pip rail and the
 * unmet linked-input glyph. Source data lives in `task_outputs` /
 * `task_inputs` / `playbook_outputs`; this is the batched view.
 */
export interface TaskIOSummary {
  taskId: string;
  /** One entry per declared `playbook_outputs` row, sorted by `position`
   *  ascending. `status` reflects the matching `task_outputs.status` if a
   *  row exists, otherwise defaults to `"pending"`. `name` mirrors the
   *  source `playbook_outputs.name` so the matrix can render it in pip
   *  tooltips. */
  outputs: { id: string; position: number; status: TaskOutputStatus; name: string }[];
  /** True iff at least one `linked` input on the task has no `task_inputs`
   *  row with `received=true`. */
  hasUnmetLinkedInput: boolean;
}

export interface FrameworkItem {
  id: string;
  type: FrameworkItemType;
  name: string;
  description: string;
  icon: string | null;
  /** Hex color (e.g. "#6366f1") chosen by the founder. Drives the colored
   *  ring around the emoji avatar everywhere this item is rendered, plus the
   *  matrix row + task accent. Falls back to a stable id-derived hash when
   *  null (`resolveItemColor` in `lib/workflows/skill-colors.ts`). */
  color?: string | null;
  content: string;
  /**
   * Only populated for `type === "playbook"`. The list of skill ids
   * (matching `framework_items.id` of type 'skill') that are allowed
   * to use this playbook in the matrix.
   */
  allowedSkillIds?: string[];
  /**
   * Only populated for `type === "skill"`. The inverse projection of the
   * same `framework_item_allowed_skills` join: which playbooks this skill
   * is allowed to run.
   */
  allowedPlaybookIds?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface WorkflowTaskPatch {
  skillId?: string;
  stageId?: string;
  notes?: string;
  status?: WorkflowTaskStatus;
  substatus?: string;
  checkpoint?: boolean;
  inputs?: WorkflowInput[];
  outputs?: PlaybookOutput[];
  playbookId?: string | null;
  owners?: string[];
  pausedReason?: string | null;
  pausedBy?: string | null;
  pausedAt?: string | null;
}

export interface WorkflowTemplatePatch {
  label?: string;
  color?: string;
  stages?: WorkflowStage[];
  skills?: WorkflowSkill[];
  taskTemplates?: WorkflowTaskTemplate[];
}

export interface WorkflowEventInput {
  name: string;
  description?: string;
  payload?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Template ↔ instance sync — diff shape returned by
// `WorkflowRepository.getInstanceTemplateDiff`, and the selection shape the
// sync drawer sends back to `applyTemplateSync`. The diff is computed by the
// pure `diffInstanceFromTemplate` in `lib/workflows/template-sync.ts`.
// ---------------------------------------------------------------------------

export interface StageRename {
  id: string;
  from: WorkflowStage;
  to: WorkflowStage;
}

export interface SkillRename {
  id: string;
  from: WorkflowSkill;
  to: WorkflowSkill;
}

export interface InputDiff {
  added: WorkflowInput[];
  removed: WorkflowInput[];
  changed: { id: string; from: WorkflowInput; to: WorkflowInput }[];
}

/**
 * Per-task diff. `syncable === "yes"` iff the instance task is pristine —
 * `status === "not_started"` AND no `task_outputs.status='produced'` rows.
 * The repository re-checks this server-side before applying; the UI uses
 * it to render the checkbox-vs-info-row split.
 */
export interface TaskFieldDiff {
  instanceTaskId: string;
  templateTaskId: string;
  instanceStatus: WorkflowTaskStatus;
  fields: {
    notes?: { from: string; to: string };
    playbookId?: { from: string | null; to: string | null };
    checkpoint?: { from: boolean; to: boolean };
    owners?: { from: string[]; to: string[] };
    inputs?: InputDiff;
  };
  syncable: "yes" | "informational_only";
  syncBlockedReason?: "task_not_pristine";
}

export interface InstanceTemplateDiff {
  templateId: string;
  instanceId: string;
  templateSyncedAt: string | null;
  stages: {
    added: WorkflowStage[];
    removedFromTemplate: WorkflowStage[];
    renamed: StageRename[];
  };
  skills: {
    added: WorkflowSkill[];
    removedFromTemplate: WorkflowSkill[];
    renamed: SkillRename[];
  };
  tasks: {
    added: WorkflowTaskTemplate[];
    removedFromTemplate: WorkflowTask[];
    changed: TaskFieldDiff[];
  };
}

/**
 * Sent by the sync drawer to `applyTemplateSync`. Each list holds the ids of
 * the diff entries the user ticked. The repository re-derives the diff
 * server-side and only applies changes whose id appears here AND still
 * satisfies the apply rules (e.g. a task that became non-pristine between
 * the drawer fetch and the apply call is silently dropped from `taskChanges`).
 */
export interface TemplateSyncSelection {
  stageIdsToAdd: string[];
  skillIdsToAdd: string[];
  stageIdsToRename: string[];
  skillIdsToRename: string[];
  taskTemplateIdsToAdd: string[];
  /** Instance task ids whose changed fields should be overwritten from the
   *  template. The repository ignores entries whose backing instance task is
   *  no longer pristine. */
  instanceTaskIdsToUpdate: string[];
}

/**
 * Returned by `WorkflowRepository.getTemplateMatrix`. One entry per
 * `task_templates[]` on the template, with status counts and per-instance
 * detail rolled up across every instance of that template.
 */
export interface TemplateCellAggregate {
  templateTaskId: string;
  skillId: string;
  stageId: string;
  playbookId: string | null;
  statusCounts: Record<WorkflowTaskStatus, number>;
  instances: {
    instanceId: string;
    instanceLabel: string;
    taskId: string;
    status: WorkflowTaskStatus;
    hasUnmetLinkedInput: boolean;
    owners: string[];
  }[];
}

export interface TemplateMatrix {
  template: WorkflowTemplate;
  instances: WorkflowInstance[];
  cells: TemplateCellAggregate[];
}

export interface WorkflowRepository {
  getTemplates(): Promise<WorkflowTemplate[]>;
  getTemplate(id: string): Promise<WorkflowTemplate | null>;
  getInstance(id: string): Promise<WorkflowInstanceDetail | null>;
  getTask(taskId: string): Promise<WorkflowTask | null>;
  transitionPendingCheckpoint(
    taskId: string,
    nextStatus: WorkflowCheckpointTransitionStatus,
  ): Promise<WorkflowTask | null>;
  updateTaskIfStatus(
    taskId: string,
    expectedStatus: WorkflowTaskStatus,
    patch: WorkflowTaskPatch,
  ): Promise<WorkflowTask | null>;
  listInstances(templateId?: string): Promise<WorkflowInstance[]>;
  listAllTasks(): Promise<WorkflowTask[]>;
  listRecentEvents(limit: number): Promise<WorkflowEvent[]>;
  createInstance(templateId: string, label: string): Promise<WorkflowInstanceDetail>;
  updateInstance(
    instanceId: string,
    patch: Partial<Pick<WorkflowInstance, "label" | "status">>,
  ): Promise<WorkflowInstance>;
  deleteInstance(instanceId: string): Promise<void>;
  createTask(input: WorkflowTaskCreateInput): Promise<WorkflowTask>;
  updateTask(taskId: string, patch: WorkflowTaskPatch): Promise<WorkflowTask>;
  deleteTask(taskId: string): Promise<void>;
  createTemplate(label: string, color: string): Promise<WorkflowTemplate>;
  updateTemplate(
    templateId: string,
    patch: WorkflowTemplatePatch,
  ): Promise<WorkflowTemplate>;
  deleteTemplate(templateId: string): Promise<void>;
  addEvent(taskId: string, event: WorkflowEventInput): Promise<WorkflowEvent>;
  addInstanceEvent(
    instanceId: string,
    event: WorkflowEventInput & { taskId?: string | null },
  ): Promise<WorkflowEvent>;
  /** Drawer-shaped read: task + per-instance input/output state +
   *  the underlying playbook's output definitions, in one round-trip. */
  getDrawerData(taskId: string): Promise<DrawerData | null>;
  /** Mark a manual input as received. Idempotent (received=true stays true). */
  markInputReceived(taskId: string, inputId: string): Promise<TaskInputState>;
  /** Bypass an input. Sets received=true with received_from=null so the
   *  audit trail can distinguish "produced upstream" from "skipped". */
  bypassInput(taskId: string, inputId: string): Promise<TaskInputState>;
  /** Produce a task output. Flips status='produced' (which fires the
   *  on_task_output_produced trigger). Inserts the row if missing. */
  produceOutput(
    taskId: string,
    outputId: string,
    artifact?: OutputArtifact,
  ): Promise<TaskOutput>;
  /** List declared outputs for a Playbook, sorted by `position` ascending. */
  listPlaybookOutputs(playbookId: string): Promise<PlaybookOutput[]>;
  /**
   * Outputs grouped per playbook for every playbook attached to the given
   * template (via `taskTemplates[].playbookId`). Drives the input-wiring
   * picker in the template editor: founders can only wire a downstream
   * `linked` input to outputs from playbooks already on the same template.
   * Includes attached playbooks with zero declared outputs so the picker
   * can render an empty-state CTA. Outputs are sorted by `position` asc.
   */
  listOutputsForTemplate(
    templateId: string,
  ): Promise<TemplateOutputGroup[]>;
  /** Insert a new playbook output. If `position` is omitted, the row is
   *  appended after the highest existing position for the same playbook.
   *  Throws `WorkflowRepositoryError` with `code: 'unique_name'` when the
   *  (playbook_id, name) pair conflicts. */
  createPlaybookOutput(input: {
    playbookId: string;
    name: string;
    description?: string | null;
    kind: PlaybookOutputKind;
    apiCheck?: Record<string, unknown> | null;
    position?: number;
  }): Promise<PlaybookOutput>;
  /** Patch a playbook output. Same `unique_name` translation as create. */
  updatePlaybookOutput(
    id: string,
    patch: Partial<{
      name: string;
      description: string | null;
      kind: PlaybookOutputKind | null;
      apiCheck: Record<string, unknown> | null;
      position: number;
    }>,
  ): Promise<PlaybookOutput>;
  deletePlaybookOutput(id: string): Promise<void>;
  /** Persist `position` for the given ids in declaration order. Tolerates
   *  ids that no longer exist (e.g. deleted between fetch and reorder). */
  reorderPlaybookOutputs(
    playbookId: string,
    orderedIds: string[],
  ): Promise<void>;
  /** Count `task_outputs` rows referencing this output (used to surface
   *  cascade-delete impact in the confirm modal). */
  countTaskOutputsForPlaybookOutput(outputId: string): Promise<number>;
  /** List declared inputs for a Playbook, sorted by `position` ascending.
   *  Each row is hydrated with the upstream output's display fields
   *  (`upstreamOutputName`, `upstreamOutputKind`, `upstreamPlaybookId`,
   *  `upstreamPlaybookName`) so the dock can render the "Playbook /
   *  Output" chip without a second join. */
  listPlaybookInputs(playbookId: string): Promise<PlaybookInput[]>;
  /** Wire a playbook to an upstream output of another playbook. If
   *  `position` is omitted, the row is appended after the highest existing
   *  position for the same playbook. Throws `WorkflowRepositoryError` with
   *  `code: 'unique_upstream'` when the (playbook_id, upstream_output_id)
   *  pair already exists. */
  createPlaybookInput(input: {
    playbookId: string;
    upstreamOutputId: string;
    position?: number;
  }): Promise<PlaybookInput>;
  deletePlaybookInput(id: string): Promise<void>;
  /** Persist `position` for the given ids in declaration order. Tolerates
   *  ids that no longer exist (e.g. deleted between fetch and reorder).
   *  Uses per-row UPDATEs to avoid the NOT-NULL serialization bug that
   *  bit reorderPlaybookOutputs (see PR #234 commit body). */
  reorderPlaybookInputs(
    playbookId: string,
    orderedIds: string[],
  ): Promise<void>;
  /** Outputs grouped per playbook for every playbook *other than* the
   *  given one. Drives the dock's input-wiring picker on the playbook edit
   *  page (the user is wiring this playbook to outputs from other ones).
   *  Outputs are sorted by `position` asc; playbooks with zero outputs are
   *  omitted (nothing to wire to). */
  listOutputGroupsForOtherPlaybooks(
    currentPlaybookId: string,
  ): Promise<TemplateOutputGroup[]>;
  pauseTask(
    taskId: string,
    reason: string,
    pausedBy?: string | null,
  ): Promise<WorkflowTask>;
  resumeTask(taskId: string): Promise<WorkflowTask>;
  /** Compute the diff between an instance and its template's current state.
   *  Loads template, instance, tasks, and the per-task IO summary in one
   *  pass; the diff itself is computed by the pure
   *  `diffInstanceFromTemplate` helper. */
  getInstanceTemplateDiff(instanceId: string): Promise<InstanceTemplateDiff>;
  /** Apply the user-selected subset of a sync diff to the instance. Server
   *  re-derives the diff and re-checks pristine-ness on each task update;
   *  non-applicable selection entries are dropped silently. Returns the
   *  refreshed instance detail so the matrix can re-render. */
  applyTemplateSync(
    instanceId: string,
    selection: TemplateSyncSelection,
  ): Promise<WorkflowInstanceDetail>;
  /** Roll up status across every instance of a template, grouped by the
   *  template's `task_templates[]` (matched via `template_task_id`).
   *  Drives the template-level matrix overview at
   *  `/workflows/templates/[templateId]`. */
  getTemplateMatrix(templateId: string): Promise<TemplateMatrix | null>;
  getFrameworkItems(type?: FrameworkItemType): Promise<FrameworkItem[]>;
  upsertFrameworkItem(item: FrameworkItem): Promise<FrameworkItem>;
  deleteFrameworkItem(itemId: string): Promise<void>;
}
