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

export type InputLinkMode = "linked" | "manual" | "bypass";

/**
 * A task's data-flow dependency. Replaces the previous `WorkflowTrigger` /
 * `WorkflowGate` split: only the data-flow trigger types (`task`,
 * `after_task`) survived the redesign — they become `linked` inputs. The
 * remaining trigger/gate vocabulary was removed.
 *
 * `upstreamOutputId` is wired up by PR 2 (AEL-60) once `playbook_outputs`
 * exists; until then it is always `null` for `linked` inputs and unused
 * for `manual` / `bypass`.
 */
export interface WorkflowInput {
  id: string;
  name: string;
  description?: string;
  linkMode: InputLinkMode;
  upstreamTaskRef?: string;
  upstreamOutputId?: string | null;
}

export interface WorkflowTaskTemplate {
  id?: string;
  skillId: string;
  stageId: string;
  playbookId: string | null;
  notes?: string;
  checkpoint?: boolean;
  inputs?: WorkflowInput[];
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
  playbookId: string | null;
  /** Owner labels (people or AI agents) assigned to this specific card.
   *  Per-task so two cards pointing at the same playbook can carry different
   *  owners (e.g. different sales people across instances). */
  owners: string[];
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
  pauseTask(
    taskId: string,
    reason: string,
    pausedBy?: string | null,
  ): Promise<WorkflowTask>;
  resumeTask(taskId: string): Promise<WorkflowTask>;
  getFrameworkItems(type?: FrameworkItemType): Promise<FrameworkItem[]>;
  upsertFrameworkItem(item: FrameworkItem): Promise<FrameworkItem>;
  deleteFrameworkItem(itemId: string): Promise<void>;
}
