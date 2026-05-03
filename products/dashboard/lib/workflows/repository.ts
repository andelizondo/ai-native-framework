import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  FrameworkItem,
  FrameworkItemType,
  WorkflowEvent,
  WorkflowEventInput,
  WorkflowInstance,
  WorkflowInstanceDetail,
  WorkflowCheckpointTransitionStatus,
  WorkflowRepository,
  WorkflowSkill,
  WorkflowTask,
  WorkflowTaskCreateInput,
  WorkflowTaskPatch,
  WorkflowTaskStatus,
  WorkflowTaskTemplate,
  WorkflowTemplatePatch,
  WorkflowTemplate,
} from "./types";

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
  skills: unknown;
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
  triggers: unknown;
  gates: unknown;
  playbook_id: string | null;
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
    skills: toJsonArray(row.skills),
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
    skills: toJsonArray(row.skills),
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
    triggers: toJsonArray(row.triggers),
    gates: toJsonArray(row.gates),
    playbookId: row.playbook_id,
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

function mapFrameworkItem(
  row: FrameworkItemRow,
  allowedSkillIds?: string[],
): FrameworkItem {
  const item: FrameworkItem = {
    id: row.id,
    type: row.type,
    name: row.name,
    description: row.description,
    icon: row.icon,
    content: row.content,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
  if (row.type === "playbook") {
    item.allowedSkillIds = allowedSkillIds ?? [];
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
  if (patch.triggers !== undefined) row.triggers = patch.triggers;
  if (patch.gates !== undefined) row.gates = patch.gates;
  if (patch.playbookId !== undefined) row.playbook_id = patch.playbookId;
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

      return {
        ...mapInstance(instanceRow as WorkflowInstanceRow),
        tasks: (taskRows ?? []).map((row) => mapTask(row as WorkflowTaskRow)),
        events: (eventRows ?? []).map((row) => mapEvent(row as WorkflowEventRow)),
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
      const { data, error } = await client
        .from("workflow_tasks")
        .update({ status: nextStatus })
        .eq("id", taskId)
        .eq("checkpoint", true)
        .eq("status", "pending_approval")
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

      const { data: insertedInstance, error: insertErr } = await client
        .from("workflow_instances")
        .insert({
          template_id: template.id,
          label,
          status: "active",
          skills: template.skills as unknown as WorkflowSkill[],
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
            triggers: tpl.triggers ?? [],
            gates: tpl.gates ?? [],
            playbook_id: tpl.playbookId ?? null,
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
          triggers: input.triggers ?? [],
          gates: input.gates ?? [],
          playbook_id: input.playbookId ?? null,
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

      // Bulk-fetch allowed-skill rows for any returned playbook so we
      // populate `allowedSkillIds` in a single round-trip.
      const playbookIds = rows.filter((r) => r.type === "playbook").map((r) => r.id);
      const allowedByPlaybook = new Map<string, string[]>();
      if (playbookIds.length > 0) {
        const { data: allowedRows, error: allowedErr } = await client
          .from("framework_item_allowed_skills")
          .select("playbook_id, skill_id")
          .in("playbook_id", playbookIds);

        if (allowedErr) {
          throw new WorkflowRepositoryError(
            "getFrameworkItems allowed_skills failed",
            allowedErr,
          );
        }
        for (const row of (allowedRows ?? []) as AllowedSkillRow[]) {
          const list = allowedByPlaybook.get(row.playbook_id) ?? [];
          list.push(row.skill_id);
          allowedByPlaybook.set(row.playbook_id, list);
        }
      }

      return rows.map((row) =>
        mapFrameworkItem(row, allowedByPlaybook.get(row.id) ?? []),
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
          content: item.content,
        })
        .select("*")
        .single();

      const saved = mapFrameworkItem(
        unwrap("upsertFrameworkItem", data, error) as FrameworkItemRow,
      );

      // For playbooks, replace the allowed-skills relation. We do this in
      // two statements because Supabase JS doesn't expose transactional
      // batches — accept the brief inconsistency window for V1 simplicity.
      if (saved.type === "playbook") {
        const desired = item.allowedSkillIds ?? [];

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
          const { error: insertErr } = await client
            .from("framework_item_allowed_skills")
            .insert(
              desired.map((skillId) => ({
                playbook_id: saved.id,
                skill_id: skillId,
              })),
            );
          if (insertErr) {
            throw new WorkflowRepositoryError(
              "upsertFrameworkItem allowed_skills insert failed",
              insertErr,
            );
          }
        }

        saved.allowedSkillIds = desired;
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
}
