// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";

import { TaskCard } from "@/components/workflows/task-card";
import type { TaskBarState } from "@/lib/workflows/matrix";
import type { FrameworkItem, WorkflowTask } from "@/lib/workflows/types";

function task(overrides: Partial<WorkflowTask> = {}): WorkflowTask {
  return {
    id: "task-1",
    instanceId: "inst-1",
    skillId: "sales-ops",
    stageId: "pre-sales",
    notes: "",
    status: "in_progress",
    substatus: "",
    checkpoint: false,
    inputs: [],
    playbookId: "presales-qualification",
    owners: [],
    createdAt: "2026-04-19T12:00:00Z",
    updatedAt: "2026-04-19T12:00:00Z",
    ...overrides,
  };
}

const PLAYBOOK: FrameworkItem = {
  id: "presales-qualification",
  type: "playbook",
  name: "Project Description",
  description: "Define objective, identify PDR need",
  icon: "📄",
  content: "",
};

describe("TaskCard", () => {
  it("renders the playbook name and active status pill", () => {
    render(
      <TaskCard task={task()} playbook={PLAYBOOK} skillColor="#6366f1" barState="bar-active" />,
    );

    const card = screen.getByTestId("task-card-task-1");
    expect(within(card).getByText("Project Description")).toBeInTheDocument();
    // Playbook description no longer appears on the matrix card; the slot is
    // reserved for per-task notes.
    expect(
      within(card).queryByText("Define objective, identify PDR need"),
    ).not.toBeInTheDocument();
    expect(within(card).getByText("In progress")).toBeInTheDocument();
  });

  it("renders task notes when present", () => {
    render(
      <TaskCard
        task={task({ id: "with-notes", notes: "Pre-sales follow-up" })}
        playbook={PLAYBOOK}
        skillColor="#6366f1"
        barState="bar-active"
      />,
    );
    const card = screen.getByTestId("task-card-with-notes");
    expect(within(card).getByText("Pre-sales follow-up")).toBeInTheDocument();
  });

  it.each<[WorkflowTask["status"], TaskBarState, string]>([
    ["complete", "bar-complete", "Complete"],
    ["in_progress", "bar-active", "In progress"],
    ["running", "bar-active", "Running"],
    ["paused", "bar-glow", "Paused"],
    ["failed", "bar-glow", "Failed"],
    ["waiting", "bar-locked", "Waiting"],
    ["not_started", "bar-ready", "Not started"],
    ["not_started", "bar-locked", "Not started"],
  ])(
    "wires the %s status to the %s class and pill text",
    (status, barState, pillText) => {
      render(
        <TaskCard
          task={task({ id: `t-${barState}`, status })}
          playbook={PLAYBOOK}
          skillColor="#6366f1"
          barState={barState}
        />,
      );

      const card = screen.getByTestId(`task-card-t-${barState}`);
      expect(card.className).toContain(barState);
      expect(card.dataset.bar).toBe(barState);
      expect(within(card).getByText(pillText)).toBeInTheDocument();
    },
  );

  it("propagates the skill colour as a CSS custom property for the bar", () => {
    render(
      <TaskCard
        task={task({ id: "with-color" })}
        playbook={PLAYBOOK}
        skillColor="#10b981"
        barState="bar-active"
      />,
    );

    const card = screen.getByTestId("task-card-with-color");
    expect(card.style.getPropertyValue("--role-color")).toBe("#10b981");
  });

  it("renders the playbook name as title and skill colour as bar accent", () => {
    render(
      <TaskCard
        task={task({ id: "with-avatar" })}
        playbook={{ ...PLAYBOOK, color: "#a855f7" }}
        skillColor="#10b981"
        barState="bar-active"
      />,
    );

    const card = screen.getByTestId("task-card-with-avatar");
    expect(within(card).getByText("Project Description")).toBeInTheDocument();
    expect(card.style.getPropertyValue("--role-color")).toBe("#10b981");
  });

  it("renders the checkpoint as a warning info-badge in the status row", () => {
    render(
      <TaskCard
        task={task({ id: "cp-overlay", checkpoint: true })}
        playbook={PLAYBOOK}
        skillColor="#6366f1"
        barState="bar-glow"
      />,
    );

    const card = screen.getByTestId("task-card-cp-overlay");
    const badge = screen.getByTestId("task-checkpoint-cp-overlay");
    expect(badge).toBeInTheDocument();
    expect(badge.className).toContain("tc-info-badge--warning");
    // The badge lives in the status row, not in the footer / owner area.
    const statusRow = card.querySelector(".tc-status-row");
    expect(statusRow).toBeTruthy();
    expect(statusRow).toContainElement(badge);
    expect(card.querySelector(".tc-bottom")).not.toContainElement(badge);
  });

  it("renders an error info-badge when the task is blocked", () => {
    render(
      <TaskCard
        task={task({ id: "blocked-task", status: "failed" })}
        playbook={PLAYBOOK}
        skillColor="#6366f1"
        barState="bar-glow"
      />,
    );
    const badge = screen.getByTestId("task-error-blocked-task");
    expect(badge).toBeInTheDocument();
    expect(badge.className).toContain("tc-info-badge--error");
  });

  it("renders the checkpoint pip only when the task has checkpoint: true", () => {
    const { rerender } = render(
      <TaskCard
        task={task({ id: "cp-on", checkpoint: true })}
        playbook={PLAYBOOK}
        skillColor="#6366f1"
        barState="bar-glow"
      />,
    );
    expect(screen.getByTestId("task-checkpoint-cp-on")).toBeInTheDocument();

    rerender(
      <TaskCard
        task={task({ id: "cp-on", checkpoint: false })}
        playbook={PLAYBOOK}
        skillColor="#6366f1"
        barState="bar-glow"
      />,
    );
    expect(screen.queryByTestId("task-checkpoint-cp-on")).not.toBeInTheDocument();
  });
});
