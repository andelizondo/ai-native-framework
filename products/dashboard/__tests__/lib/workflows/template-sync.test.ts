// @vitest-environment node

import { describe, expect, it } from "vitest";

import {
  diffInstanceFromTemplate,
  filterApplicableTaskUpdates,
} from "@/lib/workflows/template-sync";
import type {
  TaskIOSummary,
  TemplateSyncSelection,
  WorkflowInput,
  WorkflowInstance,
  WorkflowTask,
  WorkflowTaskTemplate,
  WorkflowTemplate,
} from "@/lib/workflows/types";

/**
 * Unit tests for `diffInstanceFromTemplate` (pure, no Supabase). Covers the
 * three classes of change the sync drawer surfaces — added, removed,
 * changed — plus the pristine/non-pristine gate that decides whether a
 * task field change is syncable or merely informational.
 */

function template(overrides: Partial<WorkflowTemplate> = {}): WorkflowTemplate {
  return {
    id: "tpl-1",
    label: "Client Delivery",
    color: "#6366f1",
    multiInstance: true,
    stages: [
      { id: "stage-a", label: "Discover" },
      { id: "stage-b", label: "Deliver" },
    ],
    skills: [
      { id: "skill-x", label: "Sales", owners: [] },
      { id: "skill-y", label: "Project", owners: [] },
    ],
    taskTemplates: [
      taskTemplate("tt-1", "skill-x", "stage-a", { playbookId: "pb-discovery" }),
      taskTemplate("tt-2", "skill-y", "stage-b", { playbookId: "pb-deliver" }),
    ],
    createdAt: "2026-05-17T09:00:00Z",
    updatedAt: "2026-05-17T09:00:00Z",
    ...overrides,
  };
}

function taskTemplate(
  id: string,
  skillId: string,
  stageId: string,
  overrides: Partial<WorkflowTaskTemplate> = {},
): WorkflowTaskTemplate {
  return {
    id,
    skillId,
    stageId,
    playbookId: null,
    notes: "",
    checkpoint: false,
    inputs: [],
    owners: [],
    ...overrides,
  };
}

function instance(overrides: Partial<WorkflowInstance> = {}): WorkflowInstance {
  return {
    id: "inst-1",
    templateId: "tpl-1",
    label: "Acme",
    status: "active",
    stages: [
      { id: "stage-a", label: "Discover" },
      { id: "stage-b", label: "Deliver" },
    ],
    skills: [
      { id: "skill-x", label: "Sales", owners: [] },
      { id: "skill-y", label: "Project", owners: [] },
    ],
    templateSyncedAt: "2026-05-17T09:00:00Z",
    createdAt: "2026-05-17T09:00:00Z",
    updatedAt: "2026-05-17T09:00:00Z",
    ...overrides,
  };
}

function task(
  id: string,
  templateTaskId: string | null,
  overrides: Partial<WorkflowTask> = {},
): WorkflowTask {
  return {
    id,
    instanceId: "inst-1",
    skillId: "skill-x",
    stageId: "stage-a",
    notes: "",
    status: "not_started",
    substatus: "",
    checkpoint: false,
    inputs: [],
    outputs: [],
    playbookId: null,
    owners: [],
    templateTaskId,
    pausedReason: null,
    pausedBy: null,
    pausedAt: null,
    createdAt: "2026-05-17T09:00:00Z",
    updatedAt: "2026-05-17T09:00:00Z",
    ...overrides,
  };
}

describe("diffInstanceFromTemplate — stages", () => {
  it("reports stages added to the template but missing on the instance", () => {
    const tpl = template({
      stages: [
        { id: "stage-a", label: "Discover" },
        { id: "stage-b", label: "Deliver" },
        { id: "stage-c", label: "Wrap up" },
      ],
    });
    const inst = instance(); // still only stage-a + stage-b
    const diff = diffInstanceFromTemplate(tpl, inst, []);
    expect(diff.stages.added.map((s) => s.id)).toEqual(["stage-c"]);
    expect(diff.stages.removedFromTemplate).toEqual([]);
    expect(diff.stages.renamed).toEqual([]);
  });

  it("flags stages removed from the template without proposing removal", () => {
    const tpl = template({ stages: [{ id: "stage-a", label: "Discover" }] });
    const inst = instance();
    const diff = diffInstanceFromTemplate(tpl, inst, []);
    expect(diff.stages.removedFromTemplate.map((s) => s.id)).toEqual(["stage-b"]);
    expect(diff.stages.added).toEqual([]);
  });

  it("detects label renames while preserving the id", () => {
    const tpl = template({
      stages: [
        { id: "stage-a", label: "Discovery" },
        { id: "stage-b", label: "Deliver" },
      ],
    });
    const diff = diffInstanceFromTemplate(tpl, instance(), []);
    expect(diff.stages.renamed).toEqual([
      { id: "stage-a", from: { id: "stage-a", label: "Discover" }, to: { id: "stage-a", label: "Discovery" } },
    ]);
  });
});

describe("diffInstanceFromTemplate — skills", () => {
  it("reports added/removed/renamed skills symmetrically with stages", () => {
    const tpl = template({
      skills: [
        { id: "skill-x", label: "Sales (new)", owners: [] },
        { id: "skill-z", label: "Marketing", owners: [] },
      ],
    });
    const diff = diffInstanceFromTemplate(tpl, instance(), []);
    expect(diff.skills.added.map((s) => s.id)).toEqual(["skill-z"]);
    expect(diff.skills.removedFromTemplate.map((s) => s.id)).toEqual(["skill-y"]);
    expect(diff.skills.renamed.map((r) => r.id)).toEqual(["skill-x"]);
  });
});

describe("diffInstanceFromTemplate — tasks", () => {
  it("classifies tasks by lineage: added, removed, changed", () => {
    const tpl = template({
      taskTemplates: [
        // tt-1 exists on both sides
        taskTemplate("tt-1", "skill-x", "stage-a", { playbookId: "pb-discovery", notes: "Updated notes" }),
        // tt-3 is new on the template
        taskTemplate("tt-3", "skill-y", "stage-a", { playbookId: "pb-followup" }),
      ],
    });
    const tasks: WorkflowTask[] = [
      task("task-1", "tt-1", { playbookId: "pb-discovery", notes: "Old notes" }),
      // tt-2 was on the template originally but is now removed
      task("task-2", "tt-2", { skillId: "skill-y", stageId: "stage-b", playbookId: "pb-deliver" }),
      // ad-hoc task created on the instance — never had a template counterpart,
      // must not appear in any diff bucket
      task("task-adhoc", null, { skillId: "skill-x", stageId: "stage-b" }),
    ];
    const diff = diffInstanceFromTemplate(tpl, instance(), tasks);
    expect(diff.tasks.added.map((t) => t.id)).toEqual(["tt-3"]);
    expect(diff.tasks.removedFromTemplate.map((t) => t.id)).toEqual(["task-2"]);
    expect(diff.tasks.changed.map((c) => c.templateTaskId)).toEqual(["tt-1"]);
    expect(diff.tasks.changed[0]!.fields.notes).toEqual({
      from: "Old notes",
      to: "Updated notes",
    });
  });

  it("marks a changed task as informational once it has moved off not_started", () => {
    const tpl = template({
      taskTemplates: [taskTemplate("tt-1", "skill-x", "stage-a", { notes: "New notes" })],
    });
    const inst = instance();
    const startedTask = task("task-1", "tt-1", {
      notes: "Old",
      status: "in_progress",
    });
    const diff = diffInstanceFromTemplate(tpl, inst, [startedTask]);
    expect(diff.tasks.changed).toHaveLength(1);
    expect(diff.tasks.changed[0]!.syncable).toBe("informational_only");
    expect(diff.tasks.changed[0]!.syncBlockedReason).toBe("task_not_pristine");
  });

  it("marks a pristine not_started task with produced outputs as informational", () => {
    const tpl = template({
      taskTemplates: [taskTemplate("tt-1", "skill-x", "stage-a", { notes: "New" })],
    });
    const pristineTask = task("task-1", "tt-1", { notes: "Old" });
    const io: TaskIOSummary[] = [
      {
        taskId: "task-1",
        outputs: [
          { id: "po-1", position: 0, status: "produced", name: "Brief" },
        ],
        hasUnmetLinkedInput: false,
      },
    ];
    const diff = diffInstanceFromTemplate(tpl, instance(), [pristineTask], io);
    expect(diff.tasks.changed[0]!.syncable).toBe("informational_only");
  });

  it("captures input add/remove/rewire deltas inside the changed entry", () => {
    const keepInput: WorkflowInput = {
      id: "in-1",
      upstreamOutputId: "po-brief",
    };
    const addInput: WorkflowInput = {
      id: "in-2",
      upstreamOutputId: "po-plan",
      upstreamTaskRef: "tt-other",
    };
    const dropInput: WorkflowInput = {
      id: "in-old",
      upstreamOutputId: "po-stale",
    };
    const tpl = template({
      taskTemplates: [
        taskTemplate("tt-1", "skill-x", "stage-a", {
          inputs: [keepInput, addInput],
        }),
      ],
    });
    const t1 = task("task-1", "tt-1", {
      inputs: [keepInput, dropInput],
    });
    const diff = diffInstanceFromTemplate(tpl, instance(), [t1]);
    const inputs = diff.tasks.changed[0]!.fields.inputs!;
    expect(inputs.added.map((i) => i.id)).toEqual(["in-2"]);
    expect(inputs.removed.map((i) => i.id)).toEqual(["in-old"]);
    expect(inputs.changed).toEqual([]);
  });
});

describe("filterApplicableTaskUpdates", () => {
  it("drops selection ids that are not syncable in the diff", () => {
    const tpl = template({
      taskTemplates: [
        taskTemplate("tt-1", "skill-x", "stage-a", { notes: "n1" }),
        taskTemplate("tt-2", "skill-y", "stage-b", { notes: "n2" }),
      ],
    });
    const inst = instance();
    const tasks: WorkflowTask[] = [
      task("task-1", "tt-1", { notes: "old" }),
      task("task-2", "tt-2", { notes: "old", status: "in_progress" }),
    ];
    const diff = diffInstanceFromTemplate(tpl, inst, tasks);
    const selection: TemplateSyncSelection = {
      stageIdsToAdd: [],
      skillIdsToAdd: [],
      stageIdsToRename: [],
      skillIdsToRename: [],
      taskTemplateIdsToAdd: [],
      instanceTaskIdsToUpdate: ["task-1", "task-2"],
    };
    const applicable = filterApplicableTaskUpdates(selection, diff);
    expect(applicable).toEqual(["task-1"]);
  });
});
