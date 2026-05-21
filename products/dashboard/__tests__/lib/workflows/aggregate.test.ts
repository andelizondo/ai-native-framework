// @vitest-environment node

import { describe, expect, it } from "vitest";

import {
  aggregateTasksByTemplateCell,
  computeOverviewStats,
  computeTemplateHealth,
  percentComplete,
  pickActiveTasks,
  pickPendingCheckpoints,
  pickRecentEvents,
  type OverviewSnapshot,
} from "@/lib/workflows/aggregate";
import type {
  TaskIOSummary,
  WorkflowEvent,
  WorkflowInstance,
  WorkflowTask,
  WorkflowTemplate,
} from "@/lib/workflows/types";

/**
 * Pure-function tests for the Overview aggregations.
 *
 * Spec anchor: AEL-49 — Overview screen with real data ("Unit:
 * aggregation math (completion %)"). The math underpins both the four
 * stat-card numbers and the Process Health rollup, so tests cover
 * empty / partial / fully-complete denominators and per-template
 * grouping.
 */

function template(
  id: string,
  label: string,
  color: string,
): WorkflowTemplate {
  return {
    id,
    label,
    color,
    multiInstance: true,
    stages: [],
    skills: [],
    taskTemplates: [],
    createdAt: "2026-04-19T12:00:00Z",
    updatedAt: "2026-04-19T12:00:00Z",
  };
}

function instance(
  id: string,
  templateId: string,
  status: WorkflowInstance["status"] = "active",
): WorkflowInstance {
  return {
    id,
    templateId,
    label: id,
    status,
    stages: [],
    skills: [],
    createdAt: "2026-04-19T12:00:00Z",
    updatedAt: "2026-04-19T12:00:00Z",
  };
}

function task(
  id: string,
  instanceId: string,
  status: WorkflowTask["status"] = "not_started",
  overrides: Partial<WorkflowTask> = {},
): WorkflowTask {
  // PR 2 / AEL-60: pickPendingCheckpoints now requires checkpoint=true AND
  // pausedReason='checkpoint' (paused for any other reason isn't a pending
  // approval). The helper applies that default for paused tasks so existing
  // fixtures keep flagging as pending checkpoints.
  const isPausedCheckpoint = status === "paused";
  return {
    id,
    instanceId,
    skillId: "skill-x",
    stageId: "stage-x",
    notes: "",
    status,
    substatus: "",
    checkpoint: isPausedCheckpoint,
    inputs: [],
    outputs: [],
    playbookId: null,
    owners: [],
    pausedReason: isPausedCheckpoint ? "checkpoint" : null,
    pausedBy: null,
    pausedAt: isPausedCheckpoint ? "2026-04-19T12:00:00Z" : null,
    createdAt: "2026-04-19T12:00:00Z",
    updatedAt: "2026-04-19T12:00:00Z",
    ...overrides,
  };
}

function event(
  id: string,
  instanceId: string,
  name: string,
  createdAt: string,
): WorkflowEvent {
  return {
    id,
    instanceId,
    taskId: null,
    name,
    description: name,
    payload: {},
    createdAt,
  };
}

describe("percentComplete", () => {
  it("returns 0 when total is 0 to keep the UI free of NaN", () => {
    expect(percentComplete(0, 0)).toBe(0);
  });

  it("rounds half-up to the nearest integer", () => {
    expect(percentComplete(1, 3)).toBe(33);
    expect(percentComplete(2, 3)).toBe(67);
    expect(percentComplete(1, 2)).toBe(50);
  });

  it("clamps non-finite inputs to 0", () => {
    expect(percentComplete(Number.NaN, 10)).toBe(0);
    expect(percentComplete(10, Number.POSITIVE_INFINITY)).toBe(0);
    expect(percentComplete(10, -1)).toBe(0);
  });
});

describe("computeOverviewStats", () => {
  it("returns all-zero stats for an empty snapshot", () => {
    const snapshot: OverviewSnapshot = {
      templates: [],
      instances: [],
      tasks: [],
      events: [],
    };
    expect(computeOverviewStats(snapshot)).toEqual({
      activeInstances: 0,
      pendingTasks: 0,
      activeTasks: 0,
      completedTasks: 0,
      totalTasks: 0,
      completionPct: 0,
    });
  });

  it("counts active instances (anything not 'complete') and bucketed tasks", () => {
    const snapshot: OverviewSnapshot = {
      templates: [template("t-1", "Delivery", "#6366f1")],
      instances: [
        instance("i-1", "t-1", "active"),
        instance("i-2", "t-1", "blocked"),
        instance("i-3", "t-1", "complete"),
      ],
      tasks: [
        task("k-1", "i-1", "complete"),
        task("k-2", "i-1", "in_progress"),
        task("k-3", "i-2", "paused"),
        task("k-4", "i-2", "not_started"),
        task("k-5", "i-3", "complete"),
      ],
      events: [],
    };

    const stats = computeOverviewStats(snapshot);
    expect(stats.activeInstances).toBe(2);
    expect(stats.activeTasks).toBe(1);
    expect(stats.pendingTasks).toBe(1);
    expect(stats.completedTasks).toBe(2);
    expect(stats.totalTasks).toBe(5);
    expect(stats.completionPct).toBe(40);
  });
});

describe("computeTemplateHealth", () => {
  const t1 = template("delivery", "Client Delivery", "#6366f1");
  const t2 = template("product", "Product Dev", "#10b981");
  const t3 = template("gtm", "GTM", "#f59e0b");

  it("groups instances under templates, including templates with zero instances", () => {
    const snapshot: OverviewSnapshot = {
      templates: [t1, t2, t3],
      instances: [instance("i-a", "delivery"), instance("i-b", "product")],
      tasks: [
        task("k-1", "i-a", "complete"),
        task("k-2", "i-a", "in_progress"),
        task("k-3", "i-a", "complete"),
        task("k-4", "i-b", "not_started"),
      ],
      events: [],
    };

    const health = computeTemplateHealth(snapshot);
    expect(health).toHaveLength(3);

    const delivery = health.find((h) => h.template.id === "delivery")!;
    expect(delivery.instances).toHaveLength(1);
    expect(delivery.totalTasks).toBe(3);
    expect(delivery.completedTasks).toBe(2);
    expect(delivery.completionPct).toBe(67);

    const product = health.find((h) => h.template.id === "product")!;
    expect(product.totalTasks).toBe(1);
    expect(product.completedTasks).toBe(0);
    expect(product.completionPct).toBe(0);

    const gtm = health.find((h) => h.template.id === "gtm")!;
    expect(gtm.instances).toEqual([]);
    expect(gtm.completionPct).toBe(0);
  });
});

describe("pickPendingCheckpoints", () => {
  it("returns only pending_approval tasks with their parent template attached", () => {
    const t1 = template("delivery", "Client Delivery", "#6366f1");
    const i1 = instance("i-1", "delivery");
    const snapshot: OverviewSnapshot = {
      templates: [t1],
      instances: [i1],
      tasks: [
        task("k-1", "i-1", "paused"),
        task("k-2", "i-1", "in_progress"),
      ],
      events: [],
    };

    const pending = pickPendingCheckpoints(snapshot);
    expect(pending).toHaveLength(1);
    expect(pending[0]!.task.id).toBe("k-1");
    expect(pending[0]!.instance.id).toBe("i-1");
    expect(pending[0]!.template?.id).toBe("delivery");
  });

  it("drops orphaned tasks whose instance no longer exists", () => {
    const snapshot: OverviewSnapshot = {
      templates: [],
      instances: [],
      tasks: [task("k-orphan", "ghost", "paused")],
      events: [],
    };
    expect(pickPendingCheckpoints(snapshot)).toEqual([]);
  });
});

describe("pickActiveTasks", () => {
  it("returns only active tasks with their parent template attached", () => {
    const t1 = template("delivery", "Client Delivery", "#6366f1");
    const i1 = instance("i-1", "delivery");
    const snapshot: OverviewSnapshot = {
      templates: [t1],
      instances: [i1],
      tasks: [
        task("k-1", "i-1", "in_progress", { playbookId: "Discovery call v3" }),
        task("k-2", "i-1", "paused"),
        task("k-3", "i-1", "complete"),
        task("k-4", "i-1", "in_progress", { playbookId: null }),
      ],
      events: [],
    };

    const active = pickActiveTasks(snapshot);
    expect(active.map((a) => a.task.id)).toEqual(["k-1", "k-4"]);
    expect(active[0]!.template?.id).toBe("delivery");
    expect(active[0]!.task.playbookId).toBe("Discovery call v3");
    expect(active[1]!.task.playbookId).toBeNull();
  });

  it("drops orphaned tasks whose instance no longer exists", () => {
    const snapshot: OverviewSnapshot = {
      templates: [],
      instances: [],
      tasks: [task("k-orphan", "ghost", "in_progress")],
      events: [],
    };
    expect(pickActiveTasks(snapshot)).toEqual([]);
  });

  it("returns null template when the parent template is missing", () => {
    const i1 = instance("i-1", "missing-template");
    const snapshot: OverviewSnapshot = {
      templates: [],
      instances: [i1],
      tasks: [task("k-1", "i-1", "in_progress")],
      events: [],
    };
    const active = pickActiveTasks(snapshot);
    expect(active).toHaveLength(1);
    expect(active[0]!.template).toBeNull();
  });

  it("returns an empty list for an empty snapshot", () => {
    expect(
      pickActiveTasks({ templates: [], instances: [], tasks: [], events: [] }),
    ).toEqual([]);
  });
});

describe("pickRecentEvents", () => {
  const snapshot: OverviewSnapshot = {
    templates: [],
    instances: [],
    tasks: [],
    events: [
      event("e-1", "i-1", "workflow.checkpoint_requested", "2026-04-19T15:00:00Z"),
      event("e-2", "i-1", "workflow.task_updated", "2026-04-19T14:00:00Z"),
      event("e-3", "i-2", "workflow.task_started", "2026-04-19T13:00:00Z"),
      event("e-4", "i-2", "workflow.instance_created", "2026-04-19T12:00:00Z"),
      event("e-5", "i-2", "workflow.task_completed", "2026-04-19T11:00:00Z"),
    ],
  };

  it("returns the first N events from the already-sorted feed", () => {
    expect(pickRecentEvents(snapshot, 4).map((e) => e.id)).toEqual([
      "e-1",
      "e-2",
      "e-3",
      "e-4",
    ]);
  });

  it("returns an empty list for non-positive limits", () => {
    expect(pickRecentEvents(snapshot, 0)).toEqual([]);
    expect(pickRecentEvents(snapshot, -3)).toEqual([]);
  });
});

describe("aggregateTasksByTemplateCell", () => {
  it("rolls up status across instances per template cell, keyed by template_task_id", () => {
    const tpl: WorkflowTemplate = {
      ...template("delivery", "Client Delivery", "#6366f1"),
      stages: [
        { id: "stage-a", label: "Discover" },
        { id: "stage-b", label: "Deliver" },
      ],
      skills: [
        { id: "skill-x", label: "Sales", owners: [] },
      ],
      taskTemplates: [
        {
          id: "tt-1",
          skillId: "skill-x",
          stageId: "stage-a",
          playbookId: "pb-discovery",
          notes: "",
          checkpoint: false,
          inputs: [],
          owners: [],
        },
        {
          id: "tt-2",
          skillId: "skill-x",
          stageId: "stage-b",
          playbookId: "pb-deliver",
          notes: "",
          checkpoint: false,
          inputs: [],
          owners: [],
        },
      ],
    };
    const inst1: WorkflowInstance = { ...instance("acme", "delivery"), createdAt: "2026-05-01T00:00:00Z" };
    const inst2: WorkflowInstance = { ...instance("globex", "delivery"), createdAt: "2026-05-02T00:00:00Z" };
    const inst3: WorkflowInstance = { ...instance("initech", "delivery"), createdAt: "2026-05-03T00:00:00Z" };

    const tasks: WorkflowTask[] = [
      // tt-1: 2 not_started, 1 in_progress
      task("k-a1", "acme", "not_started", { templateTaskId: "tt-1" }),
      task("k-g1", "globex", "in_progress", { templateTaskId: "tt-1" }),
      task("k-i1", "initech", "not_started", { templateTaskId: "tt-1" }),
      // tt-2: 1 complete (acme), nothing else
      task("k-a2", "acme", "complete", { templateTaskId: "tt-2" }),
      // ad-hoc task — must not skew the rollup
      task("k-adhoc", "globex", "in_progress", { templateTaskId: undefined }),
    ];
    const io: TaskIOSummary[] = [
      { taskId: "k-i1", outputs: [], hasUnmetLinkedInput: true },
    ];

    const cells = aggregateTasksByTemplateCell(tpl, [inst1, inst2, inst3], tasks, io);

    expect(cells).toHaveLength(2);
    const tt1 = cells.find((c) => c.templateTaskId === "tt-1")!;
    expect(tt1.statusCounts.not_started).toBe(2);
    expect(tt1.statusCounts.in_progress).toBe(1);
    expect(tt1.statusCounts.complete).toBe(0);
    expect(tt1.instances.map((i) => i.instanceId)).toEqual(["acme", "globex", "initech"]);
    const initech = tt1.instances.find((i) => i.instanceId === "initech")!;
    expect(initech.hasUnmetLinkedInput).toBe(true);

    const tt2 = cells.find((c) => c.templateTaskId === "tt-2")!;
    expect(tt2.statusCounts.complete).toBe(1);
    expect(tt2.instances.map((i) => i.instanceId)).toEqual(["acme"]);
  });

  it("returns zeroed cells when the template has no instances yet", () => {
    const tpl: WorkflowTemplate = {
      ...template("delivery", "Client Delivery", "#6366f1"),
      stages: [{ id: "stage-a", label: "Discover" }],
      skills: [{ id: "skill-x", label: "Sales", owners: [] }],
      taskTemplates: [
        {
          id: "tt-only",
          skillId: "skill-x",
          stageId: "stage-a",
          playbookId: "pb-x",
          notes: "",
          checkpoint: false,
          inputs: [],
          owners: [],
        },
      ],
    };
    const cells = aggregateTasksByTemplateCell(tpl, [], [], []);
    expect(cells).toHaveLength(1);
    expect(cells[0]!.statusCounts.not_started).toBe(0);
    expect(cells[0]!.instances).toEqual([]);
  });
});
