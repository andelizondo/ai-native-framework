// Shared workflow domain types. These mirror the SQL schema in
// `products/dashboard/supabase/migrations/` and the `workflow_repository`
// interface defined in `interfaces/interfaces.yaml`.

export type WorkflowInstanceStatus =
  | "not_started"
  | "active"
  | "blocked"
  | "complete";

export type WorkflowTaskStatus =
  | "not_started"
  | "active"
  | "pending_approval"
  | "blocked"
  | "complete";

/**
 * Legal terminal states for `WorkflowRepository.transitionPendingCheckpoint`.
 */
export type WorkflowCheckpointTransitionStatus =
  | Extract<WorkflowTaskStatus, "complete">
  | Extract<WorkflowTaskStatus, "blocked">;

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

export interface WorkflowTrigger {
  type: string;
  label?: string;
  taskRef?: string;
  taskId?: string;
  eventName?: string;
}

export interface WorkflowGate {
  type: string;
  label?: string;
}

export interface WorkflowTaskTemplate {
  id?: string;
  skillId: string;
  stageId: string;
  playbookId: string | null;
  notes?: string;
  checkpoint?: boolean;
  triggers?: WorkflowTrigger[];
  gates?: WorkflowGate[];
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
  triggers: WorkflowTrigger[];
  gates: WorkflowGate[];
  playbookId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowTaskCreateInput {
  instanceId: string;
  skillId: string;
  stageId: string;
  playbookId: string | null;
  notes?: string;
  checkpoint?: boolean;
  triggers?: WorkflowTrigger[];
  gates?: WorkflowGate[];
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
  skills: WorkflowSkill[];
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowInstanceDetail extends WorkflowInstance {
  tasks: WorkflowTask[];
  events: WorkflowEvent[];
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
  triggers?: WorkflowTrigger[];
  gates?: WorkflowGate[];
  playbookId?: string | null;
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
  getFrameworkItems(type?: FrameworkItemType): Promise<FrameworkItem[]>;
  upsertFrameworkItem(item: FrameworkItem): Promise<FrameworkItem>;
  deleteFrameworkItem(itemId: string): Promise<void>;
}
