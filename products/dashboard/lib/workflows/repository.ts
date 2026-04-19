import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  FrameworkItem,
  FrameworkItemType,
  WorkflowEvent,
  WorkflowEventInput,
  WorkflowInstance,
  WorkflowInstanceDetail,
  WorkflowRepository,
  WorkflowRole,
  WorkflowTask,
  WorkflowTaskPatch,
  WorkflowTaskTemplate,
  WorkflowTemplate,
} from "./types";

// Row shapes returned by Supabase. Kept private — callers consume the camelCase
// domain types defined in `./types`. Mapping happens once here so the rest of
// the app never touches snake_case.
interface WorkflowTemplateRow {
  id: string;
  label: string;
  color: string;
  multi_instance: boolean;
  stages: unknown;
  roles: unknown;
  task_templates: unknown;
  created_at: string;
  updated_at: string;
}

interface WorkflowInstanceRow {
  id: string;
  template_id: string;
  label: string;
  status: WorkflowInstance["status"];
  roles: unknown;
  created_at: string;
  updated_at: string;
}

interface WorkflowTaskRow {
  id: string;
  instance_id: string;
  role_id: string;
  stage_id: string;
  title: string;
  description: string;
  status: WorkflowTask["status"];
  substatus: string;
  checkpoint: boolean;
  triggers: unknown;
  gates: unknown;
  agent: string | null;
  skill: string | null;
  playbook: string | null;
  created_at: string;
  updated_at: string;
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
  content: string;
  created_at: string;
  updated_at: string;
}

function toJsonArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function toJsonObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function mapTemplate(row: WorkflowTemplateRow): WorkflowTemplate {
  return {
    id: row.id,
    label: row.label,
    color: row.color,
    multiInstance: row.multi_instance,
    stages: toJsonArray(row.stages),
    roles: toJsonArray(row.roles),
    taskTemplates: toJsonArray(row.task_templates),
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
    roles: toJsonArray(row.roles),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapTask(row: WorkflowTaskRow): WorkflowTask {
  return {
    id: row.id,
    instanceId: row.instance_id,
    roleId: row.role_id,
    stageId: row.stage_id,
    title: row.title,
    description: row.description,
    status: row.status,
    substatus: row.substatus,
    checkpoint: row.checkpoint,
    triggers: toJsonArray(row.triggers),
    gates: toJsonArray(row.gates),
    agent: row.agent,
    skill: row.skill,
    playbook: row.playbook,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
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

function mapFrameworkItem(row: FrameworkItemRow): FrameworkItem {
  return {
    id: row.id,
    type: row.type,
    name: row.name,
    description: row.description,
    icon: row.icon,
    content: row.content,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function patchToRow(patch: WorkflowTaskPatch): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (patch.roleId !== undefined) row.role_id = patch.roleId;
  if (patch.stageId !== undefined) row.stage_id = patch.stageId;
  if (patch.title !== undefined) row.title = patch.title;
  if (patch.description !== undefined) row.description = patch.description;
  if (patch.status !== undefined) row.status = patch.status;
  if (patch.substatus !== undefined) row.substatus = patch.substatus;
  if (patch.checkpoint !== undefined) row.checkpoint = patch.checkpoint;
  if (patch.triggers !== undefined) row.triggers = patch.triggers;
  if (patch.gates !== undefined) row.gates = patch.gates;
  if (patch.agent !== undefined) row.agent = patch.agent;
  if (patch.skill !== undefined) row.skill = patch.skill;
  if (patch.playbook !== undefined) row.playbook = patch.playbook;
  return row;
}

export class WorkflowRepositoryError extends Error {
  readonly cause?: unknown;
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "WorkflowRepositoryError";
    this.cause = cause;
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
  return {
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

      return {
        ...mapInstance(instanceRow as WorkflowInstanceRow),
        tasks: (taskRows ?? []).map((row) => mapTask(row as WorkflowTaskRow)),
        events: (eventRows ?? []).map((row) => mapEvent(row as WorkflowEventRow)),
      };
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
      // Cap the limit defensively. Callers ask for "last 4" today; an
      // unbounded request would still be safe but pull a lot over the
      // wire as the events table grows.
      const safeLimit = Math.max(0, Math.min(limit, 200));
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
      // Fetch the template so we can copy default roles and materialize tasks.
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

      const { data: insertedInstance, error: insertErr } = await client
        .from("workflow_instances")
        .insert({
          template_id: template.id,
          label,
          status: "active",
          roles: template.roles as unknown as WorkflowRole[],
        })
        .select("*")
        .single();

      const instance = mapInstance(
        unwrap("createInstance insert", insertedInstance, insertErr) as WorkflowInstanceRow,
      );

      // Materialize tasks from template.taskTemplates. Skip when empty so
      // empty templates still produce a valid instance with no tasks.
      let tasks: WorkflowTask[] = [];
      if (template.taskTemplates.length > 0) {
        const taskRowsToInsert = template.taskTemplates.map(
          (tpl: WorkflowTaskTemplate) => ({
            instance_id: instance.id,
            role_id: tpl.role,
            stage_id: tpl.stage,
            title: tpl.title,
            description: tpl.desc ?? "",
            status: "not_started" as const,
            substatus: "",
            checkpoint: tpl.checkpoint ?? false,
            triggers: tpl.triggers ?? [],
            gates: tpl.gates ?? [],
            agent: tpl.agent ?? null,
            skill: tpl.skill ?? null,
            playbook: tpl.playbook ?? null,
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
        tasks = (insertedTasks ?? []).map((row) => mapTask(row as WorkflowTaskRow));
      }

      return { ...instance, tasks, events: [] };
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

    async addEvent(taskId: string, event: WorkflowEventInput): Promise<WorkflowEvent> {
      // Look up parent instance so events can be queried by instance directly
      // even when filtering by task is not desired.
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
      return (data ?? []).map((row) => mapFrameworkItem(row as FrameworkItemRow));
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
          content: item.content,
        })
        .select("*")
        .single();

      return mapFrameworkItem(unwrap("upsertFrameworkItem", data, error) as FrameworkItemRow);
    },
  };
}
