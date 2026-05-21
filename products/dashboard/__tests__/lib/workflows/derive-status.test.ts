import { describe, expect, it } from "vitest";

import { deriveStatus } from "@/lib/workflows/derive-status";
import type {
  TaskInputState,
  TaskOutput,
  WorkflowInput,
  WorkflowTaskStatus,
} from "@/lib/workflows/types";

function linked(id: string): WorkflowInput {
  return { id, upstreamOutputId: `out-${id}` };
}
function inputState(inputId: string, received: boolean): TaskInputState {
  return { id: `ti-${inputId}`, taskId: "t-1", inputId, received };
}
function output(status: TaskOutput["status"], outputId = "o-1"): TaskOutput {
  return {
    id: `to-${outputId}`,
    taskId: "t-1",
    outputId,
    status,
    createdAt: "2026-05-07T00:00:00Z",
  };
}

function call(args: Partial<Parameters<typeof deriveStatus>[0]>): WorkflowTaskStatus {
  return deriveStatus({
    persisted: "not_started",
    pausedReason: null,
    inputs: [],
    inputDefs: [],
    outputs: [],
    agentRun: null,
    ...args,
  });
}

describe("deriveStatus", () => {
  it("complete is terminal — no signal can move it", () => {
    expect(
      call({
        persisted: "complete",
        pausedReason: "checkpoint",
        outputs: [output("failed")],
        agentRun: { status: "failed" },
      }),
    ).toBe("complete");
  });

  it("failed wins when any output failed", () => {
    expect(
      call({
        persisted: "in_progress",
        outputs: [output("produced"), output("failed", "o-2")],
      }),
    ).toBe("failed");
  });

  it("failed wins when the agent run failed", () => {
    expect(
      call({ persisted: "in_progress", agentRun: { status: "failed" } }),
    ).toBe("failed");
  });

  it("complete when outputs are non-empty and every output produced", () => {
    expect(
      call({
        persisted: "in_progress",
        outputs: [output("produced"), output("produced", "o-2")],
      }),
    ).toBe("complete");
  });

  it("paused beats waiting and running", () => {
    expect(
      call({
        persisted: "in_progress",
        pausedReason: "checkpoint",
        inputDefs: [linked("a")],
        inputs: [inputState("a", false)],
        agentRun: { status: "running" },
      }),
    ).toBe("paused");
  });

  it("running requires an active agent run", () => {
    expect(
      call({ persisted: "in_progress", agentRun: { status: "running" } }),
    ).toBe("running");
  });

  it("in_progress carries through when no other rule matches", () => {
    expect(call({ persisted: "in_progress" })).toBe("in_progress");
  });

  it("waiting when any linked input is unreceived", () => {
    expect(
      call({
        inputDefs: [linked("a"), linked("b")],
        inputs: [inputState("a", true), inputState("b", false)],
      }),
    ).toBe("waiting");
  });

  it("not_started when nothing else matches", () => {
    expect(call({})).toBe("not_started");
  });

  it("empty pausedReason string is ignored", () => {
    expect(call({ persisted: "in_progress", pausedReason: "   " })).toBe(
      "in_progress",
    );
  });

  it("all linked inputs received and persisted=not_started → not_started", () => {
    expect(
      call({
        inputDefs: [linked("a")],
        inputs: [inputState("a", true)],
      }),
    ).toBe("not_started");
  });
});
