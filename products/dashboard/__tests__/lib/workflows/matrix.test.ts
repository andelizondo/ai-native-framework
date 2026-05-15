// @vitest-environment node

import { describe, expect, it } from "vitest";

import { barClass, canStart } from "@/lib/workflows/matrix";
import type { WorkflowInput, WorkflowTask } from "@/lib/workflows/types";

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
    inputs: [],
    outputs: [],
    playbookId: null,
    owners: [],
    createdAt: "2026-04-19T12:00:00Z",
    updatedAt: "2026-04-19T12:00:00Z",
    ...overrides,
  };
}

function linked(ref: string | undefined, name = "linked"): WorkflowInput {
  return {
    id: `linked:${ref ?? name}`,
    name,
    linkMode: "linked",
    upstreamTaskRef: ref,
    upstreamOutputId: null,
  };
}

describe("canStart", () => {
  it("returns true for tasks already past not_started regardless of inputs", () => {
    const a = task("a", { status: "in_progress", inputs: [linked("missing")] });
    expect(canStart(a, [a])).toBe(true);
  });

  it("returns true when there are no linked inputs", () => {
    const t = task("t", {
      inputs: [
        { id: "m-1", name: "Manual", linkMode: "manual" },
        { id: "b-1", name: "Bypass", linkMode: "bypass" },
      ],
    });
    expect(canStart(t, [t])).toBe(true);
  });

  it("requires every linked input's upstream task to be complete", () => {
    const upstream = task("up", { playbookId: "pdr-review", status: "in_progress" });
    const downstream = task("down", { inputs: [linked("pdr-review")] });
    expect(canStart(downstream, [upstream, downstream])).toBe(false);

    const completed = { ...upstream, status: "complete" as const };
    expect(canStart(downstream, [completed, downstream])).toBe(true);
  });

  it("manual inputs never block even when listed alongside linked ones", () => {
    const upstream = task("up", { playbookId: "p", status: "complete" });
    const t = task("t", {
      inputs: [
        linked("p"),
        { id: "m", name: "Marketing approval", linkMode: "manual" },
      ],
    });
    expect(canStart(t, [upstream, t])).toBe(true);
  });

  it("falls back to matching by task id when ref is the upstream's id", () => {
    const upstream = task("up-id", { status: "complete" });
    const t = task("t", { inputs: [linked("up-id")] });
    expect(canStart(t, [upstream, t])).toBe(true);
  });

  it("ignores linked inputs that reference unknown tasks rather than crashing", () => {
    const t = task("t", { inputs: [linked("ghost")] });
    expect(canStart(t, [t])).toBe(false);
  });
});

describe("barClass", () => {
  it("maps each task status to its prototype bar-state class", () => {
    expect(barClass(task("c", { status: "complete" }), false)).toBe("bar-complete");
    expect(barClass(task("a", { status: "in_progress" }), false)).toBe("bar-active");
    expect(barClass(task("p", { status: "paused" }), true)).toBe("bar-glow");
    expect(barClass(task("b", { status: "failed" }), true)).toBe("bar-glow");
  });

  it("splits not_started tasks into ready/locked based on canStart", () => {
    const t = task("ns", { status: "not_started" });
    expect(barClass(t, true)).toBe("bar-ready");
    expect(barClass(t, false)).toBe("bar-locked");
  });
});
