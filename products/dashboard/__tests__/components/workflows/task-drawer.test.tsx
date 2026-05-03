/**
 * Unit tests for components/workflows/task-drawer.tsx (AEL-51 — PR 8).
 *
 * Coverage:
 *   - Drawer renders with breadcrumb, title, and tab bar
 *   - Details tab: primary action card variants per task status
 *   - Approve → calls approveDrawerCheckpointAction + onTaskUpdate
 *   - Reject  → calls rejectDrawerCheckpointAction
 *   - Events tab shows task-scoped events; empty state when none
 *   - Dependencies tab shows placeholder
 *   - Overlay click calls onClose
 *   - Escape key calls onClose
 *   - TriggerGateEditor: add/remove triggers and gates
 */

import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  type MockedFunction,
} from "vitest";
import { render, screen, fireEvent, within, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type {
  WorkflowEvent,
  WorkflowInstanceDetail,
  WorkflowSkill,
  WorkflowTask,
  WorkflowTemplate,
} from "@/lib/workflows/types";
import { TaskDrawer } from "@/components/workflows/task-drawer";

// ── Module mocks ─────────────────────────────────────────────────────────────

const {
  mockApprove,
  mockReject,
  mockStart,
  mockCancelRun,
  mockRetryBlocked,
  mockUpdateTG,
  mockEmitEvent,
  mockCaptureError,
} = vi.hoisted(() => ({
  mockApprove: vi.fn(),
  mockReject: vi.fn(),
  mockStart: vi.fn(),
  mockCancelRun: vi.fn(),
  mockRetryBlocked: vi.fn(),
  mockUpdateTG: vi.fn(),
  mockEmitEvent: vi.fn(),
  mockCaptureError: vi.fn(),
}));

vi.mock("@/app/(dashboard)/workflows/actions", () => ({
  approveDrawerCheckpointAction: mockApprove,
  rejectDrawerCheckpointAction: mockReject,
  startTaskAction: mockStart,
  cancelRunningTaskAction: mockCancelRun,
  retryBlockedTaskAction: mockRetryBlocked,
  updateTaskTriggerGatesAction: mockUpdateTG,
}));

vi.mock("@/lib/events", () => ({
  emitEvent: mockEmitEvent,
}));

vi.mock("@/lib/monitoring", () => ({
  captureError: mockCaptureError,
}));

// ── Fixtures ─────────────────────────────────────────────────────────────────

const SKILLS: WorkflowSkill[] = [
  { id: "sales-ops", label: "Sales Ops", owners: ["Hans"] },
  { id: "pm", label: "PM", owners: ["Andres"] },
];

const TEMPLATE: WorkflowTemplate = {
  id: "tpl-1",
  label: "Client Delivery",
  color: "#6366f1",
  multiInstance: true,
  stages: [
    { id: "pre-sales", label: "Pre-Sales" },
    { id: "validation", label: "Validation" },
  ],
  skills: SKILLS,
  taskTemplates: [],
  createdAt: "2026-04-19T12:00:00Z",
  updatedAt: "2026-04-19T12:00:00Z",
};

function makeTask(overrides: Partial<WorkflowTask> = {}): WorkflowTask {
  return {
    id: "task-1",
    instanceId: "inst-1",
    skillId: "sales-ops",
    stageId: "pre-sales",
    notes: "Scope review",
    status: "pending_approval",
    substatus: "",
    checkpoint: true,
    triggers: [],
    gates: [],
    playbookId: null,
    createdAt: "2026-04-19T12:00:00Z",
    updatedAt: "2026-04-19T12:00:00Z",
    ...overrides,
  };
}

function makeEvent(overrides: Partial<WorkflowEvent> = {}): WorkflowEvent {
  return {
    id: "ev-1",
    instanceId: "inst-1",
    taskId: "task-1",
    name: "workflow.checkpoint_approved",
    description: "Approved checkpoint",
    payload: {},
    createdAt: "2026-04-19T13:00:00Z",
    ...overrides,
  };
}

function makeInstance(
  tasks: WorkflowTask[] = [],
  events: WorkflowEvent[] = [],
): WorkflowInstanceDetail {
  return {
    id: "inst-1",
    templateId: "tpl-1",
    label: "Acme Corp",
    status: "active",
    skills: SKILLS,
    createdAt: "2026-04-19T12:00:00Z",
    updatedAt: "2026-04-19T12:00:00Z",
    tasks,
    events,
  };
}

function renderDrawer(
  taskOverrides: Partial<WorkflowTask> = {},
  events: WorkflowEvent[] = [],
  onClose = vi.fn(),
  onTaskUpdate = vi.fn(),
  onViewLiveRun?: () => void,
) {
  const task = makeTask(taskOverrides);
  const instance = makeInstance([task], events);

  const view = render(
    <TaskDrawer
      task={task}
      instance={instance}
      skills={SKILLS}
      template={TEMPLATE}
      onClose={onClose}
      onTaskUpdate={onTaskUpdate}
      onViewLiveRun={onViewLiveRun}
    />,
  );

  return { task, onClose, onTaskUpdate, ...view };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("TaskDrawer", () => {
  beforeEach(() => {
    mockApprove.mockReset();
    mockReject.mockReset();
    mockStart.mockReset();
    mockCancelRun.mockReset();
    mockRetryBlocked.mockReset();
    mockUpdateTG.mockReset();
    mockEmitEvent.mockReset();
    mockCaptureError.mockReset();
  });

  it("renders the drawer with breadcrumb, title, and tab bar", () => {
    renderDrawer();

    const drawer = screen.getByTestId("task-drawer");
    expect(drawer).toBeInTheDocument();
    expect(drawer).toHaveAttribute("role", "dialog");

    // Breadcrumb: instance › stage › role
    const breadcrumb = within(drawer).getByText("Acme Corp");
    expect(breadcrumb).toBeInTheDocument();
    expect(within(drawer).getByText("Pre-Sales")).toBeInTheDocument();
    expect(within(drawer).getAllByText("Sales Ops").length).toBeGreaterThan(0);

    // Title (no playbook attached → "Playbook" fallback)
    expect(within(drawer).getByText("Playbook")).toBeInTheDocument();

    // Tabs
    expect(screen.getByTestId("td-tab-details")).toBeInTheDocument();
    expect(screen.getByTestId("td-tab-events")).toBeInTheDocument();
    expect(screen.getByTestId("td-tab-dependencies")).toBeInTheDocument();
  });

  it("emits dashboard.task_drawer_opened on mount", () => {
    renderDrawer({ id: "task-xyz" });
    expect(mockEmitEvent).toHaveBeenCalledWith("dashboard.task_drawer_opened", {
      task_id: "task-xyz",
    });
  });

  describe("Details tab — primary action card", () => {
    it("shows Approve + Reject buttons for pending_approval task", () => {
      renderDrawer({ status: "pending_approval", checkpoint: true });
      expect(screen.getByTestId("td-approve-btn")).toBeInTheDocument();
      expect(screen.getByTestId("td-reject-btn")).toBeInTheDocument();
    });

    it("shows Start agent button for not_started task with playbook", () => {
      renderDrawer({ status: "not_started", checkpoint: false, playbookId:"demo-pb" });
      expect(screen.getByTestId("td-start-btn")).toBeInTheDocument();
      const playbookCard = screen.getByTestId("td-playbook-card");
      expect(playbookCard).not.toHaveAttribute("role", "button");
    });

    it("shows active playbook row with stop control for running task", () => {
      renderDrawer({ status: "active", checkpoint: false, playbookId:"demo-pb" });
      const playbookCard = screen.getByTestId("td-playbook-card");
      expect(playbookCard).not.toHaveAttribute("role", "button");
      expect(screen.getByTestId("td-pb-stop-run-btn")).toBeInTheDocument();
    });

    it("shows no action card for complete task", () => {
      renderDrawer({ status: "complete", checkpoint: false });
      expect(screen.queryByTestId("td-action-card")).not.toBeInTheDocument();
    });
  });

  describe("Cancel run", () => {
    it("calls cancelRunningTaskAction and onTaskUpdate when stop is clicked", async () => {
      const updatedTask = makeTask({
        status: "blocked",
        checkpoint: false,
        playbookId:"demo-pb",
      });
      mockCancelRun.mockResolvedValue({ task: updatedTask });
      const onTaskUpdate = vi.fn();
      const { task } = renderDrawer(
        { status: "active", checkpoint: false, playbookId:"demo-pb" },
        [],
        vi.fn(),
        onTaskUpdate,
      );

      await act(async () => {
        fireEvent.click(screen.getByTestId("td-pb-stop-run-btn"));
      });

      expect(mockCancelRun).toHaveBeenCalledWith(task.id);
      expect(onTaskUpdate).toHaveBeenCalledWith(updatedTask);
      expect(mockEmitEvent).toHaveBeenCalledWith("workflow.run_cancelled", {
        task_id: task.id,
        instance_id: task.instanceId,
      });
    });
  });

  describe("Retry run", () => {
    it("calls retryBlockedTaskAction and onTaskUpdate when retry is clicked", async () => {
      const updatedTask = makeTask({
        status: "active",
        checkpoint: false,
        playbookId:"demo-pb",
      });
      mockRetryBlocked.mockResolvedValue({ task: updatedTask });
      const onTaskUpdate = vi.fn();
      const { task } = renderDrawer(
        { status: "blocked", checkpoint: false, playbookId:"demo-pb" },
        [],
        vi.fn(),
        onTaskUpdate,
      );

      await act(async () => {
        fireEvent.click(screen.getByTestId("td-pb-retry-run-btn"));
      });

      expect(mockRetryBlocked).toHaveBeenCalledWith(task.id);
      expect(onTaskUpdate).toHaveBeenCalledWith(updatedTask);
      expect(mockEmitEvent).toHaveBeenCalledWith("workflow.run_retried", {
        task_id: task.id,
        instance_id: task.instanceId,
      });
    });
  });

  describe("Playbook chat affordance", () => {
    it("only exposes button semantics when a playbook handler is provided", () => {
      renderDrawer({ status: "complete", checkpoint: false, playbookId:"demo-pb" });

      expect(screen.getByTestId("td-playbook-card")).not.toHaveAttribute("role", "button");
    });

    it("invokes onViewLiveRun for every eligible playbook-card status and skips not_started without a handler", async () => {
      const user = userEvent.setup();
      const runnableStatuses: WorkflowTask["status"][] = [
        "active",
        "blocked",
        "pending_approval",
        "complete",
      ];

      for (const status of runnableStatuses) {
        const onViewLiveRun = vi.fn();
        const { unmount } = renderDrawer(
          { status, checkpoint: false, playbookId:"demo-pb" },
          [],
          vi.fn(),
          vi.fn(),
          onViewLiveRun,
        );

        const playbookCard = screen.getByTestId("td-playbook-card");
        expect(playbookCard).toHaveAttribute("role", "button");
        await user.click(playbookCard);
        expect(onViewLiveRun).toHaveBeenCalledTimes(1);
        unmount();
      }

      renderDrawer({ status: "not_started", checkpoint: false, playbookId:"demo-pb" });
      expect(screen.getByTestId("td-playbook-card")).not.toHaveAttribute("role", "button");
    });
  });

  describe("Approve flow", () => {
    it("calls approveDrawerCheckpointAction and onTaskUpdate on success", async () => {
      const updatedTask = makeTask({ status: "active" });
      mockApprove.mockResolvedValue({ task: updatedTask });
      const onTaskUpdate = vi.fn();
      const { task } = renderDrawer({ status: "pending_approval" }, [], vi.fn(), onTaskUpdate);

      const approveBtn = screen.getByTestId("td-approve-btn");
      await act(async () => {
        fireEvent.click(approveBtn);
      });

      expect(mockApprove).toHaveBeenCalledWith(task.id);
      expect(onTaskUpdate).toHaveBeenCalledWith(updatedTask);
      expect(mockEmitEvent).toHaveBeenCalledWith(
        "workflow.checkpoint_approved",
        { task_id: task.id, instance_id: task.instanceId },
      );
    });

    it("captures error if approve action throws", async () => {
      mockApprove.mockRejectedValue(new Error("Server error"));
      renderDrawer({ status: "pending_approval" });

      await act(async () => {
        fireEvent.click(screen.getByTestId("td-approve-btn"));
      });

      expect(mockCaptureError).toHaveBeenCalledTimes(1);
    });
  });

  describe("Reject flow", () => {
    it("calls rejectDrawerCheckpointAction on reject", async () => {
      mockReject.mockResolvedValue(undefined);
      const { task } = renderDrawer({ status: "pending_approval" });

      await act(async () => {
        fireEvent.click(screen.getByTestId("td-reject-btn"));
      });

      expect(mockReject).toHaveBeenCalledWith(task.id);
      expect(mockEmitEvent).toHaveBeenCalledWith(
        "workflow.checkpoint_rejected",
        { task_id: task.id, instance_id: task.instanceId },
      );
    });
  });

  describe("Events tab", () => {
    it("shows task-scoped events", async () => {
      const user = userEvent.setup();
      const taskEv = makeEvent({ id: "ev-task", taskId: "task-1" });
      const otherEv = makeEvent({ id: "ev-other", taskId: "task-999" });
      renderDrawer({}, [taskEv, otherEv]);

      await user.click(screen.getByTestId("td-tab-events"));

      expect(screen.getByTestId("td-event-ev-task")).toBeInTheDocument();
      expect(screen.queryByTestId("td-event-ev-other")).not.toBeInTheDocument();
    });

    it("shows empty state when no events for the task", async () => {
      const user = userEvent.setup();
      renderDrawer({}, []);

      await user.click(screen.getByTestId("td-tab-events"));

      expect(screen.getByTestId("td-events-empty")).toBeInTheDocument();
    });
  });

  describe("Dependencies tab", () => {
    it("shows placeholder", async () => {
      const user = userEvent.setup();
      renderDrawer();

      await user.click(screen.getByTestId("td-tab-dependencies"));

      expect(screen.getByTestId("td-dependencies-placeholder")).toHaveTextContent(
        /DepTree coming in PR 14/i,
      );
    });
  });

  describe("Close behaviour", () => {
    it("calls onClose when overlay is clicked", () => {
      const onClose = vi.fn();
      renderDrawer({}, [], onClose);
      fireEvent.click(screen.getByTestId("task-drawer-overlay"));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("calls onClose when the close button is clicked", () => {
      const onClose = vi.fn();
      renderDrawer({}, [], onClose);
      fireEvent.click(screen.getByTestId("task-drawer-close"));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("calls onClose on Escape key", () => {
      const onClose = vi.fn();
      renderDrawer({}, [], onClose);
      fireEvent.keyDown(window, { key: "Escape" });
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe("TriggerGateEditor — triggers", () => {
    it("adds a trigger and calls updateTaskTriggerGatesAction", async () => {
      const user = userEvent.setup();
      const updatedTask = makeTask({
        triggers: [{ type: "manual", label: "New trigger" }],
      });
      mockUpdateTG.mockResolvedValue({ task: updatedTask });
      const onTaskUpdate = vi.fn();
      renderDrawer({ triggers: [] }, [], vi.fn(), onTaskUpdate);

      // Open inline form
      await user.click(screen.getByTestId("tg-add-trigger"));

      // Fill label
      const input = screen.getByPlaceholderText("Label");
      await user.type(input, "New trigger");

      // Submit
      await act(async () => {
        await user.click(screen.getByRole("button", { name: /^Add$/ }));
      });

      expect(mockUpdateTG).toHaveBeenCalledWith(
        "task-1",
        [{ type: expect.any(String), label: "New trigger" }],
        [],
      );
      expect(onTaskUpdate).toHaveBeenCalledWith(updatedTask);
    });

    it("removes a trigger by index", async () => {
      const user = userEvent.setup();
      const updatedTask = makeTask({ triggers: [] });
      mockUpdateTG.mockResolvedValue({ task: updatedTask });

      renderDrawer(
        { triggers: [{ type: "manual", label: "Old trigger" }] },
        [],
        vi.fn(),
        vi.fn(),
      );

      expect(screen.getByTestId("tg-item-trigger-0")).toBeInTheDocument();

      await act(async () => {
        await user.click(
          within(screen.getByTestId("tg-item-trigger-0")).getByRole("button", {
            name: /Remove trigger/i,
          }),
        );
      });

      expect(mockUpdateTG).toHaveBeenCalledWith("task-1", [], []);
    });
  });
});
