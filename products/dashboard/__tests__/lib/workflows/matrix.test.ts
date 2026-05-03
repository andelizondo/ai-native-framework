// @vitest-environment node

import { describe, expect, it } from "vitest";

import { barClass, canStart } from "@/lib/workflows/matrix";
import type { WorkflowTask } from "@/lib/workflows/types";

function task(
  id: string,
  overrides: Partial<WorkflowTask> = {},
): WorkflowTask {
  return {
    id,
    instanceId: "inst-1",
    skillId: "skill-x",
    stageId: "stage-x",
    notes: "",
    status: "not_started",
    substatus: "",
    checkpoint: false,
    triggers: [],
    gates: [],
    playbookId: null,
    createdAt: "2026-04-19T12:00:00Z",
    updatedAt: "2026-04-19T12:00:00Z",
    ...overrides,
  };
}

describe("canStart", () => {
  it("returns true for tasks already past not_started regardless of triggers", () => {
    const a = task("a", { status: "active", triggers: [{ type: "task", taskRef: "missing" }] });
    expect(canStart(a, [a])).toBe(true);
  });

  it("returns true when there are no task-typed triggers", () => {
    const t = task("t", {
      triggers: [
        { type: "manual", label: "Manual start" },
        { type: "event", eventName: "external.signal" },
      ],
    });
    expect(canStart(t, [t])).toBe(true);
  });

  it("requires every task-typed dependency to be complete", () => {
    const upstream = task("up", { playbookId: "pdr-review", status: "active" });
    const downstream = task("down", {
      triggers: [{ type: "after_task", taskRef: "pdr-review" }],
    });
    expect(canStart(downstream, [upstream, downstream])).toBe(false);

    const completed = { ...upstream, status: "complete" as const };
    expect(canStart(downstream, [completed, downstream])).toBe(true);
  });

  it("treats `task` and `after_task` trigger types interchangeably", () => {
    const upstream = task("up", { playbookId: "initial-invoicing", status: "complete" });
    const t = task("t", { triggers: [{ type: "task", taskRef: "initial-invoicing" }] });
    expect(canStart(t, [upstream, t])).toBe(true);
  });

  it("falls back to taskId when taskRef is missing", () => {
    const upstream = task("up-id", { status: "complete" });
    const t = task("t", { triggers: [{ type: "after_task", taskId: "up-id" }] });
    expect(canStart(t, [upstream, t])).toBe(true);
  });

  it("ignores triggers that reference unknown tasks rather than crashing", () => {
    const t = task("t", { triggers: [{ type: "after_task", taskRef: "ghost" }] });
    expect(canStart(t, [t])).toBe(false);
  });
});

describe("barClass", () => {
  it("maps each task status to its prototype bar-state class", () => {
    expect(barClass(task("c", { status: "complete" }), false)).toBe("bar-complete");
    expect(barClass(task("a", { status: "active" }), false)).toBe("bar-active");
    expect(barClass(task("p", { status: "pending_approval" }), true)).toBe("bar-pending");
    expect(barClass(task("b", { status: "blocked" }), true)).toBe("bar-cancelled");
  });

  it("splits not_started tasks into ready/locked based on canStart", () => {
    const t = task("ns", { status: "not_started" });
    expect(barClass(t, true)).toBe("bar-ready");
    expect(barClass(t, false)).toBe("bar-locked");
  });
});
