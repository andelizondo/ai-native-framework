// @vitest-environment node

import { describe, expect, it } from "vitest";

import {
  computeOverviewStats,
  computeTemplateHealth,
  percentComplete,
  pickPendingCheckpoints,
  pickRecentEvents,
  type OverviewSnapshot,
} from "@/lib/workflows/aggregate";
import type {
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
    roles: [],
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
    roles: [],
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
  return {
    id,
    instanceId,
    roleId: "role-x",
    stageId: "stage-x",
    title: id,
    description: "",
    status,
    substatus: "",
    checkpoint: false,
    triggers: [],
    gates: [],
    agent: null,
    skill: null,
    playbook: null,
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
        task("k-2", "i-1", "active"),
        task("k-3", "i-2", "pending_approval"),
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
        task("k-2", "i-a", "active"),
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
        task("k-1", "i-1", "pending_approval"),
        task("k-2", "i-1", "active"),
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
      tasks: [task("k-orphan", "ghost", "pending_approval")],
      events: [],
    };
    expect(pickPendingCheckpoints(snapshot)).toEqual([]);
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
