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
    status: "active",
    substatus: "",
    checkpoint: false,
    triggers: [],
    gates: [],
    playbookId: "presales-qualification",
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
  it("renders the playbook name + description and active status pill", () => {
    render(
      <TaskCard task={task()} playbook={PLAYBOOK} skillColor="#6366f1" barState="bar-active" />,
    );

    const card = screen.getByTestId("task-card-task-1");
    expect(within(card).getByText("Project Description")).toBeInTheDocument();
    expect(
      within(card).getByText("Define objective, identify PDR need"),
    ).toBeInTheDocument();
    expect(within(card).getByText("In progress")).toBeInTheDocument();
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

  it("renders the playbook avatar with the playbook's own colour", () => {
    render(
      <TaskCard
        task={task({ id: "with-avatar" })}
        playbook={{ ...PLAYBOOK, color: "#a855f7" }}
        skillColor="#10b981"
        barState="bar-active"
      />,
    );

    const avatar = screen.getByTestId("task-card-avatar-with-avatar");
    expect(avatar).toBeInTheDocument();
    // The ItemAvatar inside renders the emoji.
    expect(within(avatar).getByText("📄")).toBeInTheDocument();
  });

  it("overlays the checkpoint badge on the avatar (not in the title row)", () => {
    render(
      <TaskCard
        task={task({ id: "cp-overlay", checkpoint: true })}
        playbook={PLAYBOOK}
        skillColor="#6366f1"
        barState="bar-pending"
      />,
    );

    const badge = screen.getByTestId("task-checkpoint-cp-overlay");
    const avatarWrap = screen.getByTestId("task-card-avatar-cp-overlay");
    expect(avatarWrap).toContainElement(badge);
    expect(badge.className).toContain("tc-cp-badge-overlay");
  });

  it("renders the checkpoint pip only when the task has checkpoint: true", () => {
    const { rerender } = render(
      <TaskCard
        task={task({ id: "cp-on", checkpoint: true })}
        playbook={PLAYBOOK}
        skillColor="#6366f1"
        barState="bar-pending"
      />,
    );
    expect(screen.getByTestId("task-checkpoint-cp-on")).toBeInTheDocument();

    rerender(
      <TaskCard
        task={task({ id: "cp-on", checkpoint: false })}
        playbook={PLAYBOOK}
        skillColor="#6366f1"
        barState="bar-pending"
      />,
    );
    expect(screen.queryByTestId("task-checkpoint-cp-on")).not.toBeInTheDocument();
  });
});
