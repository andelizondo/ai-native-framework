import { describe, expect, it } from "vitest";

import {
  activeStageIds,
  classifyEdge,
  isTaskActive,
  seedCollapsedSkills,
  seedCollapsedStages,
} from "@/lib/workflows/active-flow";
import type {
  TaskIOSummary,
  WorkflowSkill,
  WorkflowStage,
  WorkflowTask,
} from "@/lib/workflows/types";

function task(over: Partial<WorkflowTask>): WorkflowTask {
  return {
    id: "t",
    instanceId: "i",
    skillId: "sk",
    stageId: "st",
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
    ...over,
  };
}

function io(taskId: string, hasUnmet = false): TaskIOSummary {
  return { taskId, outputs: [], hasUnmetLinkedInput: hasUnmet };
}

const STAGES: WorkflowStage[] = [
  { id: "s1", label: "S1" },
  { id: "s2", label: "S2" },
  { id: "s3", label: "S3" },
];
const SKILLS: WorkflowSkill[] = [
  { id: "k1", label: "K1", owners: [] },
  { id: "k2", label: "K2", owners: [] },
];

describe("isTaskActive", () => {
  it("treats in_progress and running as active regardless of IO", () => {
    expect(isTaskActive(task({ status: "in_progress" }))).toBe(true);
    expect(isTaskActive(task({ status: "running" }))).toBe(true);
  });

  it("treats not_started/waiting with met inputs as active (next-up)", () => {
    expect(isTaskActive(task({ status: "not_started" }), io("t", false))).toBe(true);
    expect(isTaskActive(task({ status: "waiting" }), io("t", false))).toBe(true);
  });

  it("treats not_started with unmet inputs as inactive", () => {
    expect(isTaskActive(task({ status: "not_started" }), io("t", true))).toBe(false);
  });

  it("treats complete/paused/failed as inactive", () => {
    expect(isTaskActive(task({ status: "complete" }))).toBe(false);
    expect(isTaskActive(task({ status: "paused" }))).toBe(false);
    expect(isTaskActive(task({ status: "failed" }))).toBe(false);
  });
});

describe("classifyEdge", () => {
  const from = task({ id: "a" });
  const to = task({ id: "b" });
  it("next when upstream complete and downstream ready not-started", () => {
    expect(
      classifyEdge(
        { ...from, status: "complete" },
        { ...to, status: "not_started" },
        io("b", false),
      ),
    ).toBe("next");
  });
  it("current when upstream complete and downstream in_progress", () => {
    expect(
      classifyEdge(
        { ...from, status: "complete" },
        { ...to, status: "in_progress" },
      ),
    ).toBe("current");
  });
  it("producing when upstream is in_progress", () => {
    expect(
      classifyEdge(
        { ...from, status: "in_progress" },
        { ...to, status: "not_started" },
        io("b", true),
      ),
    ).toBe("producing");
  });
  it("settled when both complete", () => {
    expect(
      classifyEdge(
        { ...from, status: "complete" },
        { ...to, status: "complete" },
      ),
    ).toBe("settled");
  });
  it("dormant when nothing's moving", () => {
    expect(
      classifyEdge(
        { ...from, status: "not_started" },
        { ...to, status: "not_started" },
        io("b", true),
      ),
    ).toBe("dormant");
  });
});

describe("seedCollapsedStages", () => {
  it("collapses every stage except the one with an active task", () => {
    const tasks = [
      task({ id: "t1", stageId: "s2", status: "in_progress" }),
      task({ id: "t2", stageId: "s3", status: "complete" }),
    ];
    const result = seedCollapsedStages(tasks, [io("t1"), io("t2")], STAGES);
    expect([...result].sort()).toEqual(["s1", "s3"]);
  });

  it("collapses every stage when every task is complete (review mode)", () => {
    const tasks = [
      task({ id: "t1", stageId: "s1", status: "complete" }),
      task({ id: "t2", stageId: "s2", status: "complete" }),
    ];
    const result = seedCollapsedStages(tasks, [io("t1"), io("t2")], STAGES);
    expect([...result].sort()).toEqual(["s1", "s2", "s3"]);
  });

  it("collapses everything except the first stage in kickoff (all not_started, inputs unmet)", () => {
    const tasks = [
      task({ id: "t1", stageId: "s2", status: "not_started" }),
      task({ id: "t2", stageId: "s3", status: "not_started" }),
    ];
    const result = seedCollapsedStages(
      tasks,
      [io("t1", true), io("t2", true)],
      STAGES,
    );
    expect([...result].sort()).toEqual(["s2", "s3"]);
  });
});

describe("seedCollapsedSkills", () => {
  it("collapses skills with no active task", () => {
    const tasks = [
      task({ id: "t1", skillId: "k1", status: "in_progress" }),
      task({ id: "t2", skillId: "k2", status: "complete" }),
    ];
    const result = seedCollapsedSkills(tasks, [io("t1"), io("t2")], SKILLS);
    expect([...result]).toEqual(["k2"]);
  });

  it("collapses every skill when every task is complete (review mode)", () => {
    const tasks = [
      task({ id: "t1", skillId: "k1", status: "complete" }),
      task({ id: "t2", skillId: "k2", status: "complete" }),
    ];
    const result = seedCollapsedSkills(tasks, [io("t1"), io("t2")], SKILLS);
    expect([...result].sort()).toEqual(["k1", "k2"]);
  });

  it("leaves skills expanded in kickoff (no active, not all complete)", () => {
    const tasks = [task({ id: "t1", skillId: "k1", status: "not_started" })];
    const result = seedCollapsedSkills(tasks, [io("t1", true)], SKILLS);
    expect(result.size).toBe(0);
  });
});

describe("activeStageIds", () => {
  it("dedupes stages across tasks", () => {
    const tasks = [
      task({ id: "t1", stageId: "s1", status: "in_progress" }),
      task({ id: "t2", stageId: "s1", status: "running" }),
      task({ id: "t3", stageId: "s2", status: "complete" }),
    ];
    const result = activeStageIds(tasks, [io("t1"), io("t2"), io("t3")]);
    expect([...result]).toEqual(["s1"]);
  });
});
