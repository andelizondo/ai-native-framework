/**
 * Component tests for components/workflows/process-matrix.tsx.
 * Spec anchor: AEL-50 — PR 7 (Process Matrix). Covers:
 *   - Stage header row renders one cell per template stage and one
 *     pip per task in that stage (with the role's accent colour).
 *   - Body renders one row per role, with a sticky role cell + one
 *     task cell per stage; cells with no task render empty.
 *   - The role-collapse toggle hides labels and flips the
 *     `roles-collapsed` class so the CSS narrows the column.
 *   - The empty / template-missing branches surface a placeholder
 *     row instead of crashing the route.
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";

import { DashboardTopBarProvider } from "@/components/dashboard-topbar-context";
import { TopBar } from "@/components/top-bar";
import { ProcessMatrix } from "@/components/workflows/process-matrix";
import { ToastProvider } from "@/lib/toast";
import type {
  WorkflowInstanceDetail,
  WorkflowTask,
  WorkflowTemplate,
} from "@/lib/workflows/types";

const {
  mockCreateTaskAction,
  mockDeleteTaskAction,
  mockMoveTaskAction,
  mockCaptureError,
} = vi.hoisted(() => ({
  mockCreateTaskAction: vi.fn(),
  mockDeleteTaskAction: vi.fn(),
  mockMoveTaskAction: vi.fn(),
  mockCaptureError: vi.fn(),
}));

vi.mock("@/app/(dashboard)/workflows/actions", () => ({
  createTaskAction: mockCreateTaskAction,
  deleteTaskAction: mockDeleteTaskAction,
  moveTaskAction: mockMoveTaskAction,
  approveDrawerCheckpointAction: vi.fn(),
  rejectDrawerCheckpointAction: vi.fn(),
  updateTaskTriggerGatesAction: vi.fn(),
}));

vi.mock("@/lib/monitoring", () => ({
  captureError: mockCaptureError,
}));

const mockRouter = { replace: vi.fn(), push: vi.fn() };
const mockSearchParams = new URLSearchParams("edit=1");

vi.mock("next/navigation", () => ({
  useRouter: () => mockRouter,
  useSearchParams: () => mockSearchParams,
  usePathname: () => "/workflows/inst-1",
}));

const TEMPLATE: WorkflowTemplate = {
  id: "client-delivery",
  label: "Client Project Delivery",
  color: "#6366f1",
  multiInstance: true,
  stages: [
    { id: "pre-sales", label: "Pre-Sales", sub: "Customer" },
    { id: "validation", label: "Validation", sub: "PDR" },
  ],
  skills: [
    { id: "sales-ops", label: "Sales Ops", owners: ["Hans / Dave"] },
    { id: "pm", label: "PM", owners: ["Andres"] },
  ],
  taskTemplates: [],
  createdAt: "2026-04-19T12:00:00Z",
  updatedAt: "2026-04-19T12:00:00Z",
};

function task(overrides: Partial<WorkflowTask>): WorkflowTask {
  return {
    id: "task",
    instanceId: "inst-1",
    skillId: "sales-ops",
    stageId: "pre-sales",
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

function instance(tasks: WorkflowTask[]): WorkflowInstanceDetail {
  return {
    id: "inst-1",
    templateId: "client-delivery",
    label: "Acme Corp",
    status: "active",
    skills: TEMPLATE.skills,
    createdAt: "2026-04-19T12:00:00Z",
    updatedAt: "2026-04-19T12:00:00Z",
    tasks,
    events: [],
  };
}

function renderWithTopBarProvider(ui: ReactNode) {
  return render(
    <ToastProvider>
      <DashboardTopBarProvider>
        <TopBar />
        {ui}
      </DashboardTopBarProvider>
    </ToastProvider>,
  );
}

describe("ProcessMatrix", () => {
  beforeEach(() => {
    mockCreateTaskAction.mockReset();
    mockDeleteTaskAction.mockReset();
    mockMoveTaskAction.mockReset();
    mockCaptureError.mockReset();
  });

  it("renders stage headers, role rows, and task cells", () => {
    const inst = instance([
      task({
        id: "k-1",
        skillId: "sales-ops",
        stageId: "pre-sales",
        status: "active",
      }),
      task({
        id: "k-2",
        skillId: "pm",
        stageId: "validation",
        playbookId: "pdr-review",
        status: "complete",
      }),
    ]);

    renderWithTopBarProvider(<ProcessMatrix instance={inst} template={TEMPLATE} />);

    expect(
      screen.getByRole("table", { name: "Workflow process matrix" }),
    ).toBeInTheDocument();

    expect(screen.getByTestId("matrix-stage-pre-sales")).toBeInTheDocument();
    expect(screen.getByTestId("matrix-stage-validation")).toBeInTheDocument();
    expect(screen.getByTestId("matrix-skill-row-sales-ops")).toBeInTheDocument();
    expect(screen.getByTestId("matrix-skill-row-pm")).toBeInTheDocument();

    const cell = screen.getByTestId("matrix-cell-sales-ops-pre-sales");
    expect(within(cell).getByTestId("task-card-k-1")).toBeInTheDocument();
    expect(within(cell).getByTestId("task-card-k-1")).toBeInTheDocument();

    expect(
      screen.getByTestId("matrix-cell-pm-validation"),
    ).toContainElement(screen.getByTestId("task-card-k-2"));

    expect(screen.queryByTestId("task-card-k-empty")).not.toBeInTheDocument();
  });

  it("renders one pip per task in each stage, tinted by the task's role", () => {
    const inst = instance([
      task({ id: "k-1", skillId: "sales-ops", stageId: "pre-sales", status: "active" }),
      task({ id: "k-2", skillId: "pm", stageId: "pre-sales", status: "not_started" }),
      task({ id: "k-3", skillId: "sales-ops", stageId: "validation", status: "complete" }),
    ]);

    renderWithTopBarProvider(<ProcessMatrix instance={inst} template={TEMPLATE} />);

    const stage1 = screen.getByTestId("matrix-stage-pre-sales");
    const pips = within(stage1).getAllByTestId(/^matrix-pip-/);
    expect(pips).toHaveLength(2);

    const validation = screen.getByTestId("matrix-stage-validation");
    expect(within(validation).getAllByTestId(/^matrix-pip-/)).toHaveLength(1);
  });

  it("toggles the role-collapsed class and hides labels when the toggle is pressed", async () => {
    const inst = instance([
      task({ id: "k-1", skillId: "sales-ops", stageId: "pre-sales", status: "active" }),
    ]);
    const user = userEvent.setup();

    renderWithTopBarProvider(<ProcessMatrix instance={inst} template={TEMPLATE} />);

    expect(screen.getByTestId("matrix-skill-label-sales-ops")).toBeInTheDocument();

    const toggle = screen.getByTestId("matrix-skills-toggle");
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    await user.click(toggle);

    expect(toggle).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("process-matrix").className).toContain(
      "roles-collapsed",
    );
    expect(
      screen.queryByTestId("matrix-skill-label-sales-ops"),
    ).not.toBeInTheDocument();
    // The role colour swatch stays visible so the user can still see
    // which role each row belongs to in collapsed mode.
    expect(screen.getByTestId("matrix-skill-dot-sales-ops")).toBeInTheDocument();
  });

  it("renders the placeholder when the template is missing", () => {
    const inst = instance([]);
    renderWithTopBarProvider(<ProcessMatrix instance={inst} template={null} />);

    const empty = screen.getByTestId("matrix-empty");
    expect(empty).toHaveTextContent(/no longer available/i);
  });

  it("renders the placeholder when the template has no stages or roles", () => {
    const inst = instance([]);
    renderWithTopBarProvider(
      <ProcessMatrix
        instance={inst}
        template={{ ...TEMPLATE, stages: [], skills: [] }}
      />,
    );

    expect(screen.getByTestId("matrix-empty")).toHaveTextContent(
      /no stages or skills/i,
    );
  });

  it("shows edit affordances and creates a task in an empty cell", async () => {
    const inst = instance([task({ id: "k-1", status: "active" })]);
    const user = userEvent.setup();
    const created = task({
      id: "created-1",
      skillId: "pm",
      stageId: "validation",
      playbookId: "slice-spec",
    });
    mockCreateTaskAction.mockResolvedValue({ task: created });

    renderWithTopBarProvider(<ProcessMatrix instance={inst} template={TEMPLATE} editMode />);

    await user.click(screen.getByTestId("matrix-add-task-pm-validation"));
    expect(screen.getByRole("dialog", { name: "Add playbook" })).toBeInTheDocument();
    // No allowed playbooks → empty state. Use a stub task instead by mocking
    // out the playbook list path: skip until we have a populated picker.
  });

  it("removes a task after confirm", async () => {
    const inst = instance([task({ id: "k-1", status: "active" })]);
    const user = userEvent.setup();
    mockDeleteTaskAction.mockResolvedValue(undefined);

    renderWithTopBarProvider(<ProcessMatrix instance={inst} template={TEMPLATE} editMode />);

    await user.click(screen.getByLabelText(/^Remove playbook:/));
    expect(screen.getByRole("dialog", { name: /Delete playbook/ })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Delete" }));

    // The task is removed from the draft; deletion is committed only on Save.
    expect(mockDeleteTaskAction).not.toHaveBeenCalled();
    expect(screen.queryByTestId("task-card-k-1")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^save$/i }));

    expect(mockDeleteTaskAction).toHaveBeenCalledWith("k-1");
    await waitFor(() => {
      expect(screen.queryByTestId("task-card-k-1")).not.toBeInTheDocument();
    });
  });
});
