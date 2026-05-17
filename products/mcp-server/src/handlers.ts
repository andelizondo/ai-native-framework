/**
 * Operation → repository-method dispatch for the MCP server.
 *
 * Each entry maps an operation name from interfaces/interfaces.yaml
 * (also the `operation` field on a generated tool) to a function that
 * takes typed args and returns a result. The repository is resolved
 * lazily so a single dispatch table can serve every request.
 *
 * If you add a non-`ui_only` operation to interfaces.yaml and
 * re-run `npm run generate`, you MUST add a matching entry here or
 * the tool call will fail with "no handler" at runtime. The smoke
 * test asserts the two sets agree.
 */

import type { WorkflowRepository } from "../../dashboard/lib/workflows/types.ts";

import type { ResolvedPrincipal } from "./auth.ts";

export interface HandlerContext {
  readonly repo: WorkflowRepository;
  readonly principal: ResolvedPrincipal;
}

type Handler = (ctx: HandlerContext, args: Record<string, unknown>) => Promise<unknown>;

function requireString(args: Record<string, unknown>, key: string): string {
  const v = args[key];
  if (typeof v !== "string" || !v.trim()) {
    throw new Error(`${key} is required`);
  }
  return v.trim();
}

function optionalString(args: Record<string, unknown>, key: string): string | undefined {
  const v = args[key];
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

function requireObject(args: Record<string, unknown>, key: string): Record<string, unknown> {
  const v = args[key];
  if (!v || typeof v !== "object" || Array.isArray(v)) {
    throw new Error(`${key} must be an object`);
  }
  return v as Record<string, unknown>;
}

export const HANDLERS: Record<string, Handler> = {
  // --- Templates ---
  get_templates: async ({ repo }) => ({ templates: await repo.getTemplates() }),
  get_template_matrix: async ({ repo }, args) => ({
    matrix: await repo.getTemplateMatrix(requireString(args, "template_id")),
  }),
  create_template: async ({ repo }, args) => ({
    template: await repo.createTemplate(requireString(args, "label"), "#7c3aed"),
  }),
  update_template: async ({ repo }, args) => ({
    template: await repo.updateTemplate(
      requireString(args, "template_id"),
      requireObject(args, "patch") as Parameters<WorkflowRepository["updateTemplate"]>[1],
    ),
  }),
  rename_template: async ({ repo }, args) => ({
    template: await repo.updateTemplate(requireString(args, "template_id"), {
      label: requireString(args, "label"),
    } as Parameters<WorkflowRepository["updateTemplate"]>[1]),
  }),
  delete_template: async ({ repo }, args) => {
    await repo.deleteTemplate(requireString(args, "template_id"));
    return { ok: true };
  },
  list_template_outputs: async ({ repo }, args) => ({
    groups: await repo.listOutputsForTemplate(requireString(args, "template_id")),
  }),

  // --- Instances ---
  get_instance: async ({ repo }, args) => ({
    instance: await repo.getInstance(requireString(args, "id")),
  }),
  list_instances: async ({ repo }, args) => ({
    instances: await repo.listInstances(optionalString(args, "template_id")),
  }),
  create_instance: async ({ repo }, args) => ({
    instance: await repo.createInstance(
      requireString(args, "template_id"),
      requireString(args, "label"),
    ),
  }),
  rename_instance: async ({ repo }, args) => ({
    instance: await repo.updateInstance(requireString(args, "instance_id"), {
      label: requireString(args, "label"),
    }),
  }),
  delete_instance: async ({ repo }, args) => {
    await repo.deleteInstance(requireString(args, "instance_id"));
    return { ok: true };
  },
  get_instance_template_diff: async ({ repo }, args) => ({
    diff: await repo.getInstanceTemplateDiff(requireString(args, "instance_id")),
  }),
  apply_template_sync: async ({ repo }, args) => ({
    instance: await repo.applyTemplateSync(
      requireString(args, "instance_id"),
      requireObject(args, "selection") as unknown as Parameters<
        WorkflowRepository["applyTemplateSync"]
      >[1],
    ),
  }),

  // --- Tasks ---
  create_task: async ({ repo }, args) => {
    const task = requireObject(args, "task");
    return {
      task: await repo.createTask({
        instanceId: requireString(args, "instance_id"),
        ...task,
      } as Parameters<WorkflowRepository["createTask"]>[0]),
    };
  },
  update_task: async ({ repo }, args) => ({
    task: await repo.updateTask(
      requireString(args, "task_id"),
      requireObject(args, "patch") as Parameters<WorkflowRepository["updateTask"]>[1],
    ),
  }),
  update_task_details: async ({ repo }, args) => ({
    task: await repo.updateTask(
      requireString(args, "task_id"),
      requireObject(args, "details") as Parameters<WorkflowRepository["updateTask"]>[1],
    ),
  }),
  set_task_status: async ({ repo }, args) => ({
    task: await repo.updateTask(requireString(args, "task_id"), {
      status: requireString(args, "status"),
    } as Parameters<WorkflowRepository["updateTask"]>[1]),
  }),
  delete_task: async ({ repo }, args) => {
    await repo.deleteTask(requireString(args, "task_id"));
    return { ok: true };
  },
  move_task: async ({ repo }, args) => ({
    task: await repo.updateTask(
      requireString(args, "task_id"),
      requireObject(args, "target") as Parameters<WorkflowRepository["updateTask"]>[1],
    ),
  }),
  start_task: async ({ repo }, args) => ({
    task: await repo.updateTask(requireString(args, "task_id"), {
      status: "in_progress",
    } as Parameters<WorkflowRepository["updateTask"]>[1]),
  }),
  pause_task: async ({ repo }, args) => ({
    task: await repo.pauseTask(
      requireString(args, "task_id"),
      requireString(args, "reason"),
    ),
  }),
  resume_task: async ({ repo }, args) => ({
    task: await repo.resumeTask(requireString(args, "task_id")),
  }),
  cancel_running_task: async ({ repo }, args) => ({
    task: await repo.updateTask(requireString(args, "task_id"), {
      status: "failed",
      substatus: optionalString(args, "reason") ?? "cancelled",
    } as Parameters<WorkflowRepository["updateTask"]>[1]),
  }),
  retry_blocked_task: async ({ repo }, args) => ({
    task: await repo.updateTask(requireString(args, "task_id"), {
      status: "not_started",
    } as Parameters<WorkflowRepository["updateTask"]>[1]),
  }),

  // --- Task IO ---
  get_task_drawer: async ({ repo }, args) => ({
    drawer: await repo.getDrawerData(requireString(args, "task_id")),
  }),
  update_task_inputs: async ({ repo }, args) => {
    const taskId = requireString(args, "task_id");
    const inputs = args["inputs"];
    if (!Array.isArray(inputs)) throw new Error("inputs must be an array");
    for (const i of inputs as Array<{ id: string; received: boolean }>) {
      if (i.received) await repo.markInputReceived(taskId, i.id);
    }
    const task = await repo.getTask(taskId);
    return { task };
  },
  mark_input_received: async ({ repo }, args) => ({
    input: await repo.markInputReceived(
      requireString(args, "task_id"),
      requireString(args, "input_id"),
    ),
  }),
  bypass_input: async ({ repo }, args) => ({
    input: await repo.bypassInput(
      requireString(args, "task_id"),
      requireString(args, "input_id"),
    ),
  }),
  produce_task_output: async ({ repo }, args) => ({
    output: await repo.produceOutput(
      requireString(args, "task_id"),
      requireString(args, "output_id"),
      args["artifact"] as Parameters<WorkflowRepository["produceOutput"]>[2],
    ),
  }),

  // --- Checkpoints ---
  list_pending_checkpoints: async ({ repo }) => {
    const tasks = await repo.listAllTasks();
    return {
      checkpoints: tasks.filter(
        (t) => t.checkpoint && t.status === "waiting",
      ),
    };
  },
  resolve_checkpoint: async ({ repo }, args) => {
    const taskId = requireString(args, "task_id");
    const resolution = requireString(args, "resolution");
    if (resolution !== "approved" && resolution !== "rejected") {
      throw new Error("resolution must be 'approved' or 'rejected'");
    }
    const next = resolution === "approved" ? "in_progress" : "failed";
    const task = await repo.transitionPendingCheckpoint(taskId, next);
    if (!task) {
      throw new Error("Task is not a pending checkpoint or already resolved.");
    }
    return { task };
  },
  approve_drawer_checkpoint: async ({ repo }, args) => {
    const task = await repo.transitionPendingCheckpoint(
      requireString(args, "task_id"),
      "in_progress",
    );
    if (!task) throw new Error("Task is not a pending checkpoint.");
    return { task };
  },
  reject_drawer_checkpoint: async ({ repo }, args) => {
    const task = await repo.transitionPendingCheckpoint(
      requireString(args, "task_id"),
      "failed",
    );
    if (!task) throw new Error("Task is not a pending checkpoint.");
    return { task };
  },

  // --- Events ---
  add_event: async ({ repo, principal }, args) => {
    const taskId = requireString(args, "task_id");
    const eventRaw = requireObject(args, "event");
    const payload =
      (eventRaw.payload && typeof eventRaw.payload === "object"
        ? (eventRaw.payload as Record<string, unknown>)
        : {});
    return {
      event: await repo.addEvent(taskId, {
        ...eventRaw,
        payload: { ...payload, emitted_by: principal.emittedBy },
      } as unknown as Parameters<WorkflowRepository["addEvent"]>[1]),
    };
  },

  // --- Playbook refinement ---
  refine_playbook: async ({ repo, principal }, args) => {
    const taskId = requireString(args, "task_id");
    const task = await repo.getTask(taskId);
    if (!task) throw new Error("Task not found.");
    await repo.addEvent(taskId, {
      name: "workflow.playbook_refine_requested",
      description: `Refine requested: ${task.id}`,
      payload: { task_id: task.id, emitted_by: principal.emittedBy },
    } as unknown as Parameters<WorkflowRepository["addEvent"]>[1]);
    return { task };
  },

  // --- Framework library ---
  get_framework_items: async ({ repo }, args) => ({
    items: await repo.getFrameworkItems(
      optionalString(args, "type") as "skill" | "playbook" | undefined,
    ),
  }),
  upsert_framework_item: async ({ repo }, args) => ({
    item: await repo.upsertFrameworkItem(
      requireObject(args, "item") as unknown as Parameters<
        WorkflowRepository["upsertFrameworkItem"]
      >[0],
    ),
  }),
  delete_framework_item: async ({ repo }, args) => {
    await repo.deleteFrameworkItem(requireString(args, "item_id"));
    return { ok: true };
  },

  // --- Playbook outputs ---
  list_playbook_outputs: async ({ repo }, args) => ({
    outputs: await repo.listPlaybookOutputs(requireString(args, "playbook_id")),
  }),
  create_playbook_output: async ({ repo }, args) => ({
    output: await repo.createPlaybookOutput({
      playbookId: requireString(args, "playbook_id"),
      ...(requireObject(args, "output") as Record<string, unknown>),
    } as Parameters<WorkflowRepository["createPlaybookOutput"]>[0]),
  }),
  update_playbook_output: async ({ repo }, args) => ({
    output: await repo.updatePlaybookOutput(
      requireString(args, "output_id"),
      requireObject(args, "patch") as Parameters<WorkflowRepository["updatePlaybookOutput"]>[1],
    ),
  }),
  delete_playbook_output: async ({ repo }, args) => {
    await repo.deletePlaybookOutput(requireString(args, "output_id"));
    return { ok: true };
  },
  count_task_outputs_for_playbook_output: async ({ repo }, args) => ({
    count: await repo.countTaskOutputsForPlaybookOutput(
      requireString(args, "output_id"),
    ),
  }),

  // --- Playbook inputs ---
  list_playbook_inputs: async ({ repo }, args) => ({
    inputs: await repo.listPlaybookInputs(requireString(args, "playbook_id")),
  }),
  create_playbook_input: async ({ repo }, args) => ({
    input: await repo.createPlaybookInput({
      playbookId: requireString(args, "playbook_id"),
      ...(requireObject(args, "input") as Record<string, unknown>),
    } as Parameters<WorkflowRepository["createPlaybookInput"]>[0]),
  }),
  delete_playbook_input: async ({ repo }, args) => {
    await repo.deletePlaybookInput(requireString(args, "input_id"));
    return { ok: true };
  },
  list_cross_playbook_output_groups: async ({ repo }, args) => ({
    groups: await repo.listOutputGroupsForOtherPlaybooks(
      requireString(args, "playbook_id"),
    ),
  }),
};
