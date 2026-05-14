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

  describe("IO state — output pips and unmet linked-input glyph", () => {
    it("renders one filled pip per produced output and hollow pips otherwise", () => {
      render(
        <TaskCard
          task={task({ id: "io-card" })}
          playbook={PLAYBOOK}
          skillColor="#6366f1"
          barState="bar-active"
          ioState={{
            taskId: "io-card",
            outputs: [
              { id: "o-1", position: 0, status: "produced", name: "Output 1" },
              { id: "o-2", position: 1, status: "pending", name: "Output 2" },
              { id: "o-3", position: 2, status: "pending", name: "Output 3" },
            ],
            hasUnmetLinkedInput: false,
          }}
        />,
      );
      expect(screen.getByTestId("task-pip-rail-io-card")).toBeInTheDocument();
      expect(screen.getByTestId("task-pip-io-card-o-1").dataset.status).toBe("produced");
      expect(screen.getByTestId("task-pip-io-card-o-2").dataset.status).toBe("pending");
      expect(screen.getByTestId("task-pip-io-card-o-3").dataset.status).toBe("pending");
    });

    it("marks failed outputs with the failed data-status (renders as a ring)", () => {
      render(
        <TaskCard
          task={task({ id: "io-failed" })}
          playbook={PLAYBOOK}
          skillColor="#6366f1"
          barState="bar-glow"
          ioState={{
            taskId: "io-failed",
            outputs: [{ id: "o-1", position: 0, status: "failed", name: "Output 1" }],
            hasUnmetLinkedInput: false,
          }}
        />,
      );
      expect(screen.getByTestId("task-pip-io-failed-o-1").dataset.status).toBe("failed");
    });

    it("does not render the pip rail when ioState is omitted (template view)", () => {
      render(
        <TaskCard
          task={task({ id: "io-none" })}
          playbook={PLAYBOOK}
          skillColor="#6366f1"
          barState="bar-ready"
        />,
      );
      expect(screen.queryByTestId("task-pip-rail-io-none")).not.toBeInTheDocument();
      expect(screen.queryByTestId("task-unmet-input-io-none")).not.toBeInTheDocument();
    });

    it("does not render the pip rail when ioState carries no outputs", () => {
      render(
        <TaskCard
          task={task({ id: "io-empty" })}
          playbook={PLAYBOOK}
          skillColor="#6366f1"
          barState="bar-ready"
          ioState={{ taskId: "io-empty", outputs: [], hasUnmetLinkedInput: false }}
        />,
      );
      expect(screen.queryByTestId("task-pip-rail-io-empty")).not.toBeInTheDocument();
    });

    it("renders the unmet-input glyph when a linked input is unsatisfied", () => {
      render(
        <TaskCard
          task={task({ id: "io-waiting" })}
          playbook={PLAYBOOK}
          skillColor="#6366f1"
          barState="bar-locked"
          ioState={{
            taskId: "io-waiting",
            outputs: [],
            hasUnmetLinkedInput: true,
          }}
        />,
      );
      const glyph = screen.getByTestId("task-unmet-input-io-waiting");
      expect(glyph).toBeInTheDocument();
      expect(glyph).toHaveAttribute("aria-label", "Waiting on upstream output");
    });

    it("omits the unmet-input glyph when all linked inputs are received", () => {
      render(
        <TaskCard
          task={task({ id: "io-ok" })}
          playbook={PLAYBOOK}
          skillColor="#6366f1"
          barState="bar-active"
          ioState={{
            taskId: "io-ok",
            outputs: [{ id: "o-1", position: 0, status: "produced", name: "Output 1" }],
            hasUnmetLinkedInput: false,
          }}
        />,
      );
      expect(screen.queryByTestId("task-unmet-input-io-ok")).not.toBeInTheDocument();
    });
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
