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
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ProcessMatrix } from "@/components/workflows/process-matrix";
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

const TEMPLATE: WorkflowTemplate = {
  id: "client-delivery",
  label: "Client Project Delivery",
  color: "#6366f1",
  multiInstance: true,
  stages: [
    { id: "pre-sales", label: "Pre-Sales", sub: "Customer" },
    { id: "validation", label: "Validation", sub: "PDR" },
  ],
  roles: [
    { id: "sales", label: "Sales", owner: "Hans / Dave" },
    { id: "product", label: "Product", owner: "Andres" },
  ],
  taskTemplates: [],
  createdAt: "2026-04-19T12:00:00Z",
  updatedAt: "2026-04-19T12:00:00Z",
};

function task(overrides: Partial<WorkflowTask>): WorkflowTask {
  return {
    id: "task",
    instanceId: "inst-1",
    roleId: "sales",
    stageId: "pre-sales",
    title: "Project Description",
    description: "",
    status: "not_started",
    substatus: "",
    checkpoint: false,
    triggers: [],
    gates: [],
    agent: null,
    skill: null,
    playbook: null,
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
    roles: TEMPLATE.roles,
    createdAt: "2026-04-19T12:00:00Z",
    updatedAt: "2026-04-19T12:00:00Z",
    tasks,
    events: [],
  };
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
        roleId: "sales",
        stageId: "pre-sales",
        status: "active",
      }),
      task({
        id: "k-2",
        roleId: "product",
        stageId: "validation",
        title: "PDR Review",
        status: "complete",
      }),
    ]);

    render(<ProcessMatrix instance={inst} template={TEMPLATE} />);

    expect(
      screen.getByRole("table", { name: "Workflow process matrix" }),
    ).toBeInTheDocument();

    expect(screen.getByTestId("matrix-stage-pre-sales")).toBeInTheDocument();
    expect(screen.getByTestId("matrix-stage-validation")).toBeInTheDocument();
    expect(screen.getByTestId("matrix-role-row-sales")).toBeInTheDocument();
    expect(screen.getByTestId("matrix-role-row-product")).toBeInTheDocument();

    const cell = screen.getByTestId("matrix-cell-sales-pre-sales");
    expect(within(cell).getByTestId("task-card-k-1")).toBeInTheDocument();
    expect(within(cell).getByText("Project Description")).toBeInTheDocument();

    expect(
      screen.getByTestId("matrix-cell-product-validation"),
    ).toContainElement(screen.getByTestId("task-card-k-2"));

    expect(screen.queryByTestId("task-card-k-empty")).not.toBeInTheDocument();
  });

  it("renders one pip per task in each stage, tinted by the task's role", () => {
    const inst = instance([
      task({ id: "k-1", roleId: "sales", stageId: "pre-sales", status: "active" }),
      task({ id: "k-2", roleId: "product", stageId: "pre-sales", status: "not_started" }),
      task({ id: "k-3", roleId: "sales", stageId: "validation", status: "complete" }),
    ]);

    render(<ProcessMatrix instance={inst} template={TEMPLATE} />);

    const stage1 = screen.getByTestId("matrix-stage-pre-sales");
    const pips = within(stage1).getAllByTestId(/^matrix-pip-/);
    expect(pips).toHaveLength(2);

    const validation = screen.getByTestId("matrix-stage-validation");
    expect(within(validation).getAllByTestId(/^matrix-pip-/)).toHaveLength(1);
  });

  it("toggles the role-collapsed class and hides labels when the toggle is pressed", async () => {
    const inst = instance([
      task({ id: "k-1", roleId: "sales", stageId: "pre-sales", status: "active" }),
    ]);
    const user = userEvent.setup();

    render(<ProcessMatrix instance={inst} template={TEMPLATE} />);

    expect(screen.getByTestId("matrix-role-label-sales")).toBeInTheDocument();

    const toggle = screen.getByTestId("matrix-roles-toggle");
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    await user.click(toggle);

    expect(toggle).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("process-matrix").className).toContain(
      "roles-collapsed",
    );
    expect(
      screen.queryByTestId("matrix-role-label-sales"),
    ).not.toBeInTheDocument();
    // The role colour swatch stays visible so the user can still see
    // which role each row belongs to in collapsed mode.
    expect(screen.getByTestId("matrix-role-dot-sales")).toBeInTheDocument();
  });

  it("renders the placeholder when the template is missing", () => {
    const inst = instance([]);
    render(<ProcessMatrix instance={inst} template={null} />);

    const empty = screen.getByTestId("matrix-empty");
    expect(empty).toHaveTextContent(/no longer available/i);
  });

  it("renders the placeholder when the template has no stages or roles", () => {
    const inst = instance([]);
    render(
      <ProcessMatrix
        instance={inst}
        template={{ ...TEMPLATE, stages: [], roles: [] }}
      />,
    );

    expect(screen.getByTestId("matrix-empty")).toHaveTextContent(
      /no stages or roles/i,
    );
  });

  it("shows edit affordances and creates a task in an empty cell", async () => {
    const inst = instance([task({ id: "k-1", status: "active" })]);
    const user = userEvent.setup();
    const created = task({
      id: "created-1",
      roleId: "product",
      stageId: "validation",
      title: "New task",
      agent: "PM",
    });
    mockCreateTaskAction.mockResolvedValue({ task: created });

    render(<ProcessMatrix instance={inst} template={TEMPLATE} editMode />);

    await user.click(screen.getByTestId("matrix-add-task-product-validation"));
    expect(screen.getByRole("dialog", { name: "New task" })).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText("Task title"), "New task");
    await user.click(screen.getByRole("button", { name: /create task/i }));

    expect(mockCreateTaskAction).toHaveBeenCalledWith(
      expect.objectContaining({
        instanceId: "inst-1",
        roleId: "product",
        stageId: "validation",
        title: "New task",
      }),
    );
    expect(screen.getByTestId("task-card-created-1")).toBeInTheDocument();
  });

  it("removes a task after confirm", async () => {
    const inst = instance([task({ id: "k-1", status: "active" })]);
    const user = userEvent.setup();
    mockDeleteTaskAction.mockResolvedValue(undefined);

    render(<ProcessMatrix instance={inst} template={TEMPLATE} editMode />);

    await user.click(screen.getByLabelText("Remove task: Project Description"));
    expect(screen.getByRole("dialog", { name: 'Delete "Project Description"?' })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Delete" }));

    expect(mockDeleteTaskAction).toHaveBeenCalledWith("k-1");
    expect(screen.queryByTestId("task-card-k-1")).not.toBeInTheDocument();
  });
});
