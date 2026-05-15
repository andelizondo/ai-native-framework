/**
 * Component tests for components/workflows/playbook-drawer (AEL-61 / PR 3).
 *
 * Coverage:
 *   - State card visible only in waiting | paused | failed
 *   - Inputs section collapsed iff all linked inputs received
 *   - Outputs section flagged complete on `complete`
 *   - Refine card visible only on `complete`
 *   - Activity strip visible only on `running`
 *   - Action bar buttons per state
 *   - Header bar variant per state
 */

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";

import { PlaybookDrawer } from "@/components/workflows/playbook-drawer";
import type {
  DrawerData,
  FrameworkItem,
  WorkflowInstanceDetail,
  WorkflowSkill,
  WorkflowTask,
  WorkflowTaskStatus,
  WorkflowTemplate,
} from "@/lib/workflows/types";

// ── Mocks ────────────────────────────────────────────────────────────────────
const {
  mockGetDrawerData,
  mockStart,
  mockPause,
  mockResume,
  mockRetry,
  mockMarkReceived,
  mockProduce,
  mockRefine,
  mockEmitEvent,
  mockCaptureError,
} = vi.hoisted(() => ({
  mockGetDrawerData: vi.fn(),
  mockStart: vi.fn(),
  mockPause: vi.fn(),
  mockResume: vi.fn(),
  mockRetry: vi.fn(),
  mockMarkReceived: vi.fn(),
  mockProduce: vi.fn(),
  mockRefine: vi.fn(),
  mockEmitEvent: vi.fn(),
  mockCaptureError: vi.fn(),
}));

vi.mock("@/app/(dashboard)/workflows/actions", () => ({
  getDrawerDataAction: mockGetDrawerData,
  startTaskAction: mockStart,
  pauseTaskAction: mockPause,
  resumeTaskAction: mockResume,
  retryBlockedTaskAction: mockRetry,
  markInputReceivedAction: mockMarkReceived,
  produceOutputAction: mockProduce,
  refinePlaybookAction: mockRefine,
}));

vi.mock("@/lib/events", () => ({
  emitEvent: mockEmitEvent,
}));

vi.mock("@/lib/monitoring", () => ({
  captureError: mockCaptureError,
}));

// ── Fixtures ─────────────────────────────────────────────────────────────────

const SKILLS: WorkflowSkill[] = [
  { id: "pm", label: "PM", owners: ["Andres"] },
];

const TEMPLATE: WorkflowTemplate = {
  id: "tmpl",
  label: "Tmpl",
  color: "#6366f1",
  multiInstance: false,
  stages: [{ id: "discovery", label: "Discovery" }],
  skills: SKILLS,
  taskTemplates: [],
  createdAt: "2026-05-10T00:00:00Z",
  updatedAt: "2026-05-10T00:00:00Z",
};

const PLAYBOOK: FrameworkItem = {
  id: "pb-1",
  type: "playbook",
  name: "Backlog refinement",
  description: "Read fresh tickets, dedupe, classify by area.",
  icon: "📋",
  color: "#6366f1",
  content: "",
};

function makeTask(status: WorkflowTaskStatus, overrides: Partial<WorkflowTask> = {}): WorkflowTask {
  return {
    id: "task-1",
    instanceId: "inst-1",
    skillId: "pm",
    stageId: "discovery",
    notes: "",
    status,
    substatus: "",
    checkpoint: false,
    inputs: [
      { id: "in-1", name: "Discovery brief", linkMode: "linked" },
      { id: "in-2", name: "Notes", linkMode: "manual" },
    ],
    outputs: [],
    playbookId: "pb-1",
    owners: ["Andres"],
    pausedReason: status === "paused" ? "manual" : null,
    createdAt: "2026-05-10T00:00:00Z",
    updatedAt: "2026-05-10T00:00:00Z",
    ...overrides,
  };
}

function makeInstance(): WorkflowInstanceDetail {
  return {
    id: "inst-1",
    templateId: "tmpl",
    label: "Acme",
    status: "active",
    stages: TEMPLATE.stages,
    skills: SKILLS,
    tasks: [],
    events: [],
    taskIO: [],
    createdAt: "2026-05-10T00:00:00Z",
    updatedAt: "2026-05-10T00:00:00Z",
  };
}

function makeDrawerData(
  task: WorkflowTask,
  opts: { allLinkedReceived?: boolean; outputsProduced?: number; outputsFailed?: number } = {},
): DrawerData {
  const { allLinkedReceived = false, outputsProduced = 0, outputsFailed = 0 } = opts;
  return {
    task,
    inputs: [
      {
        id: "tin-1",
        taskId: task.id,
        inputId: "in-1",
        received: allLinkedReceived,
        receivedAt: allLinkedReceived ? "2026-05-10T00:01:00Z" : null,
      },
    ],
    playbookOutputs: [
      { id: "out-1", playbookId: "pb-1", name: "Refined backlog", kind: "file", position: 0, createdAt: "2026-05-10T00:00:00Z" },
      { id: "out-2", playbookId: "pb-1", name: "Acceptance criteria", kind: "file", position: 1, createdAt: "2026-05-10T00:00:00Z" },
      { id: "out-3", playbookId: "pb-1", name: "Checkpoint", kind: "manual", position: 2, createdAt: "2026-05-10T00:00:00Z" },
    ],
    outputs: [
      ...(outputsProduced >= 1
        ? [{ id: "tout-1", taskId: task.id, outputId: "out-1", status: "produced" as const, createdAt: "2026-05-10T00:01:00Z" }]
        : []),
      ...(outputsProduced >= 2
        ? [{ id: "tout-2", taskId: task.id, outputId: "out-2", status: "produced" as const, createdAt: "2026-05-10T00:01:00Z" }]
        : []),
      ...(outputsProduced >= 3
        ? [{ id: "tout-3", taskId: task.id, outputId: "out-3", status: "produced" as const, createdAt: "2026-05-10T00:01:00Z" }]
        : []),
      ...(outputsFailed >= 1
        ? [{ id: "tout-f", taskId: task.id, outputId: "out-2", status: "failed" as const, createdAt: "2026-05-10T00:01:00Z" }]
        : []),
    ],
  };
}

async function renderDrawer(
  status: WorkflowTaskStatus,
  drawerData: DrawerData,
  taskOverrides: Partial<WorkflowTask> = {},
) {
  mockGetDrawerData.mockResolvedValue(drawerData);
  const task = makeTask(status, taskOverrides);
  const result = render(
    <PlaybookDrawer
      task={task}
      instance={makeInstance()}
      skills={SKILLS}
      template={TEMPLATE}
      playbookOptions={[PLAYBOOK]}
      onClose={vi.fn()}
      onTaskUpdate={vi.fn()}
    />,
  );
  // Drain the initial getDrawerDataAction promise so realm-derived UI
  // (collapsed inputs, etc.) settles before assertions.
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
  return result;
}

describe("PlaybookDrawer", () => {
  beforeEach(() => {
    mockGetDrawerData.mockReset();
    mockStart.mockReset();
    mockPause.mockReset();
    mockResume.mockReset();
    mockRetry.mockReset();
    mockMarkReceived.mockReset();
    mockProduce.mockReset();
    mockRefine.mockReset();
    mockEmitEvent.mockReset();
    mockCaptureError.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("state card visibility", () => {
    it.each<WorkflowTaskStatus>(["not_started", "waiting", "paused", "failed"])(
      "renders the state card on %s",
      async (status) => {
        await renderDrawer(status, makeDrawerData(makeTask(status), { allLinkedReceived: status !== "waiting" }));
        expect(screen.getByTestId("pb-drawer-state-card")).toBeInTheDocument();
      },
    );

    it.each<WorkflowTaskStatus>(["in_progress", "running", "complete"])(
      "hides the state card on %s",
      async (status) => {
        await renderDrawer(status, makeDrawerData(makeTask(status), { allLinkedReceived: true, outputsProduced: status === "complete" ? 3 : 0 }));
        expect(screen.queryByTestId("pb-drawer-state-card")).not.toBeInTheDocument();
      },
    );
  });

  describe("inputs collapsed", () => {
    it("expands inputs when linked inputs are unmet", async () => {
      await renderDrawer("not_started", makeDrawerData(makeTask("not_started"), { allLinkedReceived: false }));
      const sec = screen.getByTestId("pb-drawer-inputs-section");
      expect(sec.dataset.collapsed).toBe("false");
    });

    it("collapses inputs when all linked inputs received", async () => {
      await renderDrawer("in_progress", makeDrawerData(makeTask("in_progress"), { allLinkedReceived: true }));
      const sec = screen.getByTestId("pb-drawer-inputs-section");
      expect(sec.dataset.collapsed).toBe("true");
    });
  });

  describe("outputs complete modifier", () => {
    it("flags outputs complete on status=complete", async () => {
      await renderDrawer(
        "complete",
        makeDrawerData(makeTask("complete"), { allLinkedReceived: true, outputsProduced: 3 }),
      );
      const sec = screen.getByTestId("pb-drawer-outputs-section");
      expect(sec.dataset.complete).toBe("true");
    });

    it("does not flag outputs complete on running", async () => {
      await renderDrawer(
        "running",
        makeDrawerData(makeTask("running"), { allLinkedReceived: true, outputsProduced: 1 }),
      );
      const sec = screen.getByTestId("pb-drawer-outputs-section");
      expect(sec.dataset.complete).toBe("false");
    });
  });

  describe("refine card", () => {
    it("renders on complete", async () => {
      await renderDrawer(
        "complete",
        makeDrawerData(makeTask("complete"), { allLinkedReceived: true, outputsProduced: 3 }),
      );
      expect(screen.getByTestId("pb-drawer-refine")).toBeInTheDocument();
    });

    it.each<WorkflowTaskStatus>([
      "not_started",
      "waiting",
      "paused",
      "in_progress",
      "running",
      "failed",
    ])("hides on %s", async (status) => {
      await renderDrawer(status, makeDrawerData(makeTask(status), { allLinkedReceived: status !== "waiting" }));
      expect(screen.queryByTestId("pb-drawer-refine")).not.toBeInTheDocument();
    });
  });

  describe("activity strip", () => {
    it("renders on running", async () => {
      await renderDrawer(
        "running",
        makeDrawerData(makeTask("running"), { allLinkedReceived: true, outputsProduced: 1 }),
      );
      expect(screen.getByTestId("pb-drawer-activity-strip")).toBeInTheDocument();
    });

    it.each<WorkflowTaskStatus>([
      "not_started",
      "waiting",
      "paused",
      "in_progress",
      "complete",
      "failed",
    ])("hides on %s", async (status) => {
      await renderDrawer(status, makeDrawerData(makeTask(status), { allLinkedReceived: status !== "waiting", outputsProduced: status === "complete" ? 3 : 0 }));
      expect(screen.queryByTestId("pb-drawer-activity-strip")).not.toBeInTheDocument();
    });
  });

  describe("action bar buttons", () => {
    it("Banner Start visible on not_started", async () => {
      await renderDrawer("not_started", makeDrawerData(makeTask("not_started"), { allLinkedReceived: true }));
      expect(screen.getByTestId("pb-drawer-banner-start-btn")).toBeInTheDocument();
    });

    it("Waiting banner shows upstream-task action when inputs are unmet", async () => {
      await renderDrawer("waiting", makeDrawerData(makeTask("waiting"), { allLinkedReceived: false }));
      expect(screen.getByTestId("pb-drawer-banner-waiting-btn")).toBeInTheDocument();
      expect(screen.queryByTestId("pb-drawer-banner-start-btn")).not.toBeInTheDocument();
    });

    it("Action bar never renders a dedicated Start button", async () => {
      for (const status of ["not_started", "paused", "in_progress", "running", "complete", "failed", "waiting"] as const) {
        const { unmount } = await renderDrawer(
          status,
          makeDrawerData(makeTask(status), {
            allLinkedReceived: true,
            outputsProduced: status === "complete" ? 3 : 0,
          }),
        );
        expect(screen.queryByTestId("pb-drawer-start-btn")).not.toBeInTheDocument();
        unmount();
      }
    });

    it("Pause button is never rendered (status pill drives transitions)", async () => {
      for (const status of [
        "not_started",
        "waiting",
        "paused",
        "in_progress",
        "running",
        "complete",
        "failed",
      ] as const) {
        const { unmount } = await renderDrawer(
          status,
          makeDrawerData(makeTask(status), {
            allLinkedReceived: true,
            outputsProduced: status === "complete" ? 3 : 0,
          }),
        );
        expect(screen.queryByTestId("pb-drawer-pause-btn")).not.toBeInTheDocument();
        unmount();
      }
    });

    it("Resume visible on paused (state-card action)", async () => {
      await renderDrawer("paused", makeDrawerData(makeTask("paused"), { allLinkedReceived: true }));
      expect(screen.getByTestId("pb-drawer-resume-btn")).toBeInTheDocument();
    });

    it("Retry visible on failed (state-card action)", async () => {
      await renderDrawer("failed", makeDrawerData(makeTask("failed"), { allLinkedReceived: true, outputsFailed: 1 }));
      expect(screen.getByTestId("pb-drawer-retry-btn")).toBeInTheDocument();
    });
  });

  describe("header bar variant", () => {
    it.each<[WorkflowTaskStatus, string]>([
      ["not_started", "none"],
      ["waiting", "pending"],
      ["paused", "blocked"],
      ["in_progress", "active"],
      ["running", "active"],
      ["complete", "none"],
      ["failed", "blocked"],
    ])("matches %s → %s", async (status, expected) => {
      await renderDrawer(
        status,
        makeDrawerData(makeTask(status), {
          allLinkedReceived: status !== "waiting",
          outputsProduced: status === "complete" ? 3 : 0,
        }),
      );
      const head = screen.getByTestId("pb-drawer-head");
      expect(head.dataset.barVariant).toBe(expected);
    });
  });

  describe("status pill", () => {
    it("reflects task status via data-status", async () => {
      await renderDrawer("running", makeDrawerData(makeTask("running"), { allLinkedReceived: true }));
      const pill = screen.getByTestId("pb-drawer-status-pill");
      expect(pill).toHaveAttribute("data-status", "running");
    });
  });

  describe("data fetching", () => {
    it("calls getDrawerDataAction on mount", async () => {
      await renderDrawer("not_started", makeDrawerData(makeTask("not_started"), { allLinkedReceived: true }));
      await waitFor(() => {
        expect(mockGetDrawerData).toHaveBeenCalledWith("task-1");
      });
    });
  });
});
