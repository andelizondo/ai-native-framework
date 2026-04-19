// Shared workflow domain types. These mirror the SQL schema in
// `products/dashboard/supabase/migrations/20260419120000_workflow_persistence.sql`
// and the `workflow_repository` interface defined in
// `interfaces/interfaces.yaml`.

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
 * The atomic checkpoint resolution path only ever flips a
 * `pending_approval` row to one of these two statuses — `complete`
 * for approve, `blocked` for reject — so the parameter type is
 * narrowed to keep callers from accidentally requesting (e.g.)
 * `active` or `not_started`, which would silently corrupt the
 * approval audit trail.
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

export interface WorkflowRole {
  id: string;
  label: string;
  owner?: string;
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
  role: string;
  stage: string;
  title: string;
  desc?: string;
  agent?: string;
  skill?: string;
  playbook?: string;
  checkpoint?: boolean;
  triggers?: WorkflowTrigger[];
  gates?: WorkflowGate[];
}

export interface WorkflowTemplate {
  id: string;
  label: string;
  color: string;
  multiInstance: boolean;
  stages: WorkflowStage[];
  roles: WorkflowRole[];
  taskTemplates: WorkflowTaskTemplate[];
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowTask {
  id: string;
  instanceId: string;
  roleId: string;
  stageId: string;
  title: string;
  description: string;
  status: WorkflowTaskStatus;
  substatus: string;
  checkpoint: boolean;
  triggers: WorkflowTrigger[];
  gates: WorkflowGate[];
  agent: string | null;
  skill: string | null;
  playbook: string | null;
  createdAt: string;
  updatedAt: string;
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
  roles: WorkflowRole[];
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
  content: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface WorkflowTaskPatch {
  roleId?: string;
  stageId?: string;
  title?: string;
  description?: string;
  status?: WorkflowTaskStatus;
  substatus?: string;
  checkpoint?: boolean;
  triggers?: WorkflowTrigger[];
  gates?: WorkflowGate[];
  agent?: string | null;
  skill?: string | null;
  playbook?: string | null;
}

export interface WorkflowEventInput {
  name: string;
  description?: string;
  payload?: Record<string, unknown>;
}

export interface WorkflowRepository {
  getTemplates(): Promise<WorkflowTemplate[]>;
  getInstance(id: string): Promise<WorkflowInstanceDetail | null>;
  /**
   * Single-task lookup. Returns `null` when the row is missing or RLS
   * hides it. Read-only utility for surfaces that need a single row
   * without going through `getInstance()`'s heavier joins.
   *
   * Note: do **not** use this to validate preconditions before a
   * write — the read-then-write window is racy. Use
   * `transitionPendingCheckpoint` (or a similar conditional-update
   * primitive) for state transitions that depend on the current row
   * value.
   */
  getTask(taskId: string): Promise<WorkflowTask | null>;
  /**
   * Atomic transition of a checkpoint task that is currently awaiting
   * approval. Issues a single conditional UPDATE against
   * `workflow_tasks` with `id = taskId AND checkpoint = TRUE AND
   * status = 'pending_approval'`, so the row only flips when the
   * preconditions are still true at write time. Returns the updated
   * task on success, or `null` when no row matched (task missing /
   * not a checkpoint / not in `pending_approval` / RLS-hidden) — the
   * caller decides how to surface that.
   *
   * `nextStatus` MUST be one of the legal terminal states for an
   * approval flow (`complete` for approve, `blocked` for reject). The
   * mapping from action intent to status lives in the action layer,
   * not here, so this primitive stays composable.
   */
  transitionPendingCheckpoint(
    taskId: string,
    nextStatus: WorkflowCheckpointTransitionStatus,
  ): Promise<WorkflowTask | null>;
  listInstances(templateId?: string): Promise<WorkflowInstance[]>;
  /**
   * All tasks across every instance the caller can read (RLS still
   * applies). Used by the Overview screen to compute completion stats
   * without N+1 round-trips through `getInstance()`.
   */
  listAllTasks(): Promise<WorkflowTask[]>;
  /**
   * Most recent workflow events across every instance the caller can
   * read. Ordered by `created_at` DESC; capped at `limit`.
   */
  listRecentEvents(limit: number): Promise<WorkflowEvent[]>;
  createInstance(templateId: string, label: string): Promise<WorkflowInstanceDetail>;
  updateTask(taskId: string, patch: WorkflowTaskPatch): Promise<WorkflowTask>;
  addEvent(taskId: string, event: WorkflowEventInput): Promise<WorkflowEvent>;
  getFrameworkItems(type?: FrameworkItemType): Promise<FrameworkItem[]>;
  upsertFrameworkItem(item: FrameworkItem): Promise<FrameworkItem>;
}
