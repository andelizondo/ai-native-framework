import type {
  InputDiff,
  InstanceTemplateDiff,
  SkillRename,
  StageRename,
  TaskFieldDiff,
  TaskIOSummary,
  TemplateSyncSelection,
  WorkflowInput,
  WorkflowInstance,
  WorkflowSkill,
  WorkflowStage,
  WorkflowTask,
  WorkflowTaskTemplate,
  WorkflowTemplate,
} from "./types";

/**
 * Pure diff between an instance and its template. No DB calls; everything
 * needed is passed in. The repository layer wraps this with the actual
 * loads (`getInstanceTemplateDiff`) and the apply path
 * (`applyTemplateSync`).
 *
 * The "syncable" decision for a per-task field change is intentionally
 * conservative — only tasks that are still `not_started` AND have produced
 * no outputs are eligible to be overwritten. Anything else is shown as
 * informational so the user can see the divergence but can't accidentally
 * blow away in-flight work.
 *
 * `taskIO` carries per-task output status (from the same shape the matrix
 * uses) so we can detect "any produced output" without re-querying. Passing
 * an empty array degrades gracefully to "pristine iff status=not_started",
 * which is the right answer for unit tests that don't care about outputs.
 */
export function diffInstanceFromTemplate(
  template: WorkflowTemplate,
  instance: WorkflowInstance,
  tasks: readonly WorkflowTask[],
  taskIO: readonly TaskIOSummary[] = [],
): InstanceTemplateDiff {
  return {
    templateId: template.id,
    instanceId: instance.id,
    templateSyncedAt: instance.templateSyncedAt ?? null,
    stages: diffStages(template.stages, instance.stages),
    skills: diffSkills(template.skills, instance.skills),
    tasks: diffTasks(template.taskTemplates, tasks, taskIO),
  };
}

function diffStages(
  templateStages: readonly WorkflowStage[],
  instanceStages: readonly WorkflowStage[],
): InstanceTemplateDiff["stages"] {
  const instanceById = new Map(instanceStages.map((s) => [s.id, s]));
  const templateById = new Map(templateStages.map((s) => [s.id, s]));

  const added = templateStages.filter((s) => !instanceById.has(s.id));
  const removedFromTemplate = instanceStages.filter((s) => !templateById.has(s.id));
  const renamed: StageRename[] = [];
  for (const tpl of templateStages) {
    const inst = instanceById.get(tpl.id);
    if (!inst) continue;
    if (inst.label !== tpl.label || (inst.sub ?? "") !== (tpl.sub ?? "")) {
      renamed.push({ id: tpl.id, from: inst, to: tpl });
    }
  }
  return { added, removedFromTemplate, renamed };
}

function diffSkills(
  templateSkills: readonly WorkflowSkill[],
  instanceSkills: readonly WorkflowSkill[],
): InstanceTemplateDiff["skills"] {
  const instanceById = new Map(instanceSkills.map((s) => [s.id, s]));
  const templateById = new Map(templateSkills.map((s) => [s.id, s]));

  const added = templateSkills.filter((s) => !instanceById.has(s.id));
  const removedFromTemplate = instanceSkills.filter((s) => !templateById.has(s.id));
  const renamed: SkillRename[] = [];
  for (const tpl of templateSkills) {
    const inst = instanceById.get(tpl.id);
    if (!inst) continue;
    if (inst.label !== tpl.label) {
      renamed.push({ id: tpl.id, from: inst, to: tpl });
    }
  }
  return { added, removedFromTemplate, renamed };
}

function diffTasks(
  templateTasks: readonly WorkflowTaskTemplate[],
  instanceTasks: readonly WorkflowTask[],
  taskIO: readonly TaskIOSummary[],
): InstanceTemplateDiff["tasks"] {
  const ioByTaskId = new Map(taskIO.map((io) => [io.taskId, io]));

  // Instance tasks indexed by the template task they came from. Ad-hoc
  // tasks (templateTaskId === null) are simply not part of the lineage
  // diff — they were created by the user on the instance, not from the
  // template, and the template has nothing to say about them.
  const instanceByTemplateTaskId = new Map<string, WorkflowTask>();
  for (const task of instanceTasks) {
    if (task.templateTaskId) {
      instanceByTemplateTaskId.set(task.templateTaskId, task);
    }
  }

  const templateTaskIds = new Set(
    templateTasks
      .map((t) => t.id)
      .filter((id): id is string => typeof id === "string" && id.length > 0),
  );

  const added: WorkflowTaskTemplate[] = templateTasks.filter(
    (t) => typeof t.id === "string" && t.id.length > 0 && !instanceByTemplateTaskId.has(t.id),
  );

  const removedFromTemplate: WorkflowTask[] = instanceTasks.filter(
    (t): boolean =>
      typeof t.templateTaskId === "string" &&
      t.templateTaskId.length > 0 &&
      !templateTaskIds.has(t.templateTaskId),
  );

  const changed: TaskFieldDiff[] = [];
  for (const tpl of templateTasks) {
    if (!tpl.id) continue;
    const inst = instanceByTemplateTaskId.get(tpl.id);
    if (!inst) continue;
    const fields = compareTaskFields(tpl, inst);
    if (!hasAnyFieldDiff(fields)) continue;
    const pristine = isPristine(inst, ioByTaskId.get(inst.id));
    changed.push({
      instanceTaskId: inst.id,
      templateTaskId: tpl.id,
      instanceStatus: inst.status,
      fields,
      syncable: pristine ? "yes" : "informational_only",
      syncBlockedReason: pristine ? undefined : "task_not_pristine",
    });
  }

  return { added, removedFromTemplate, changed };
}

function compareTaskFields(
  tpl: WorkflowTaskTemplate,
  inst: WorkflowTask,
): TaskFieldDiff["fields"] {
  const fields: TaskFieldDiff["fields"] = {};
  const tplNotes = tpl.notes ?? "";
  const instNotes = inst.notes ?? "";
  if (tplNotes !== instNotes) {
    fields.notes = { from: instNotes, to: tplNotes };
  }
  const tplPlaybook = tpl.playbookId ?? null;
  const instPlaybook = inst.playbookId ?? null;
  if (tplPlaybook !== instPlaybook) {
    fields.playbookId = { from: instPlaybook, to: tplPlaybook };
  }
  const tplCheckpoint = tpl.checkpoint ?? false;
  if (tplCheckpoint !== inst.checkpoint) {
    fields.checkpoint = { from: inst.checkpoint, to: tplCheckpoint };
  }
  const tplOwners = (tpl.owners ?? []).slice();
  const instOwners = inst.owners.slice();
  if (!arraysEqual(tplOwners, instOwners)) {
    fields.owners = { from: instOwners, to: tplOwners };
  }
  const inputDiff = diffInputs(tpl.inputs ?? [], inst.inputs);
  if (
    inputDiff.added.length > 0 ||
    inputDiff.removed.length > 0 ||
    inputDiff.changed.length > 0
  ) {
    fields.inputs = inputDiff;
  }
  return fields;
}

function hasAnyFieldDiff(fields: TaskFieldDiff["fields"]): boolean {
  return (
    fields.notes !== undefined ||
    fields.playbookId !== undefined ||
    fields.checkpoint !== undefined ||
    fields.owners !== undefined ||
    fields.inputs !== undefined
  );
}

function diffInputs(
  templateInputs: readonly WorkflowInput[],
  instanceInputs: readonly WorkflowInput[],
): InputDiff {
  const instanceById = new Map(instanceInputs.map((i) => [i.id, i]));
  const templateById = new Map(templateInputs.map((i) => [i.id, i]));
  const added = templateInputs.filter((i) => !instanceById.has(i.id));
  const removed = instanceInputs.filter((i) => !templateById.has(i.id));
  const changed: InputDiff["changed"] = [];
  for (const tpl of templateInputs) {
    const inst = instanceById.get(tpl.id);
    if (!inst) continue;
    if (!inputsEqual(tpl, inst)) {
      changed.push({ id: tpl.id, from: inst, to: tpl });
    }
  }
  return { added, removed, changed };
}

function inputsEqual(a: WorkflowInput, b: WorkflowInput): boolean {
  // WorkflowInput is now always an upstream-output reference (no display
  // fields, no link-mode discriminator). Two inputs are equal iff they
  // point at the same upstream output (and snapshot the same upstream
  // task pointer when present).
  return (
    a.upstreamOutputId === b.upstreamOutputId &&
    (a.upstreamTaskRef ?? null) === (b.upstreamTaskRef ?? null)
  );
}

function arraysEqual<T>(a: readonly T[], b: readonly T[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

function isPristine(
  task: WorkflowTask,
  io: TaskIOSummary | undefined,
): boolean {
  if (task.status !== "not_started") return false;
  if (!io) return true;
  return !io.outputs.some((o) => o.status === "produced");
}

/**
 * Filter a user selection down to the entries that are still applicable
 * given a freshly-computed diff. Used inside `applyTemplateSync` so a task
 * that became non-pristine between the drawer fetch and the apply call is
 * silently dropped instead of overwriting in-flight work.
 *
 * The set logic also gates on the diff actually containing the entry —
 * a stale ticked checkbox for a stage that's already been added (e.g. a
 * concurrent sync from another tab) becomes a no-op.
 */
export function filterApplicableTaskUpdates(
  selection: TemplateSyncSelection,
  diff: InstanceTemplateDiff,
): string[] {
  const syncableIds = new Set(
    diff.tasks.changed
      .filter((t) => t.syncable === "yes")
      .map((t) => t.instanceTaskId),
  );
  return selection.instanceTaskIdsToUpdate.filter((id) => syncableIds.has(id));
}
