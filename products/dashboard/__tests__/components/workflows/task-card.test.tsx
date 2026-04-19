/**
 * Component tests for components/workflows/task-card.tsx.
 * Spec anchor: AEL-50 — PR 7 (Process Matrix). Covers:
 *   - Each bar state (locked/ready/active/pending/complete/failed)
 *     toggles the `bar-*` class on the card root and the
 *     `data-bar` attribute (used by Playwright for asserting state).
 *   - The role accent colour is wired through the `--role-color`
 *     custom property so the prototype's `::before` rule paints the
 *     correct colour without per-task style branching.
 *   - Checkpoint tasks render the amber pip, plain tasks do not.
 *   - Status pill text matches the prototype labels.
 */

import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";

import { TaskCard } from "@/components/workflows/task-card";
import type { TaskBarState } from "@/lib/workflows/matrix";
import type { WorkflowTask } from "@/lib/workflows/types";

function task(overrides: Partial<WorkflowTask> = {}): WorkflowTask {
  return {
    id: "task-1",
    instanceId: "inst-1",
    roleId: "sales",
    stageId: "pre-sales",
    title: "Project Description",
    description: "Define objective, identify PDR need",
    status: "active",
    substatus: "",
    checkpoint: false,
    triggers: [],
    gates: [],
    agent: "Sales Ops",
    skill: null,
    playbook: null,
    createdAt: "2026-04-19T12:00:00Z",
    updatedAt: "2026-04-19T12:00:00Z",
    ...overrides,
  };
}

describe("TaskCard", () => {
  it("renders the title, description, agent, and active status pill", () => {
    render(
      <TaskCard task={task()} roleColor="#6366f1" barState="bar-active" />,
    );

    const card = screen.getByTestId("task-card-task-1");
    expect(within(card).getByText("Project Description")).toBeInTheDocument();
    expect(
      within(card).getByText("Define objective, identify PDR need"),
    ).toBeInTheDocument();
    expect(within(card).getByText("In progress")).toBeInTheDocument();
    expect(within(card).getByText("Sales Ops")).toBeInTheDocument();
  });

  it.each<[WorkflowTask["status"], TaskBarState, string]>([
    ["complete", "bar-complete", "Complete"],
    ["active", "bar-active", "In progress"],
    ["pending_approval", "bar-pending", "Pending approval"],
    ["blocked", "bar-cancelled", "Failed"],
    ["not_started", "bar-ready", "Not started"],
    ["not_started", "bar-locked", "Not started"],
  ])(
    "wires the %s status to the %s class and pill text",
    (status, barState, pillText) => {
      render(
        <TaskCard
          task={task({ id: `t-${barState}`, status })}
          roleColor="#6366f1"
          barState={barState}
        />,
      );

      const card = screen.getByTestId(`task-card-t-${barState}`);
      expect(card.className).toContain(barState);
      expect(card.dataset.bar).toBe(barState);
      expect(within(card).getByText(pillText)).toBeInTheDocument();
    },
  );

  it("propagates the role colour as a CSS custom property for the bar", () => {
    render(
      <TaskCard
        task={task({ id: "with-color" })}
        roleColor="#10b981"
        barState="bar-active"
      />,
    );

    const card = screen.getByTestId("task-card-with-color");
    expect(card.style.getPropertyValue("--role-color")).toBe("#10b981");
  });

  it("renders the checkpoint pip only when the task has checkpoint: true", () => {
    const { rerender } = render(
      <TaskCard
        task={task({ id: "cp-on", checkpoint: true })}
        roleColor="#6366f1"
        barState="bar-pending"
      />,
    );
    expect(screen.getByTestId("task-checkpoint-cp-on")).toBeInTheDocument();

    rerender(
      <TaskCard
        task={task({ id: "cp-on", checkpoint: false })}
        roleColor="#6366f1"
        barState="bar-pending"
      />,
    );
    expect(screen.queryByTestId("task-checkpoint-cp-on")).not.toBeInTheDocument();
  });
});
