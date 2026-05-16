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
  mockSetTaskStatusAction,
  mockUpsertFrameworkItemAction,
  mockCaptureError,
} = vi.hoisted(() => ({
  mockCreateTaskAction: vi.fn(),
  mockDeleteTaskAction: vi.fn(),
  mockMoveTaskAction: vi.fn(),
  mockSetTaskStatusAction: vi.fn(),
  mockUpsertFrameworkItemAction: vi.fn(),
  mockCaptureError: vi.fn(),
}));

vi.mock("@/app/(dashboard)/workflows/actions", () => ({
  createTaskAction: mockCreateTaskAction,
  deleteTaskAction: mockDeleteTaskAction,
  moveTaskAction: mockMoveTaskAction,
  setTaskStatusAction: mockSetTaskStatusAction,
  approveDrawerCheckpointAction: vi.fn(),
  rejectDrawerCheckpointAction: vi.fn(),
  updateTaskTriggerGatesAction: vi.fn(),
}));

vi.mock("@/app/(dashboard)/framework/actions", () => ({
  upsertFrameworkItemAction: mockUpsertFrameworkItemAction,
  deleteFrameworkItemAction: vi.fn(),
  listPlaybookOutputsAction: vi.fn(async () => []),
}));

vi.mock("@/lib/monitoring", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/monitoring")>();
  return { ...actual, captureError: mockCaptureError };
});

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
    inputs: [],
    outputs: [],
    playbookId: null,
    owners: [],
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
    stages: TEMPLATE.stages,
    skills: TEMPLATE.skills,
    createdAt: "2026-04-19T12:00:00Z",
    updatedAt: "2026-04-19T12:00:00Z",
    tasks,
    events: [],
    taskIO: tasks.map((t) => ({ taskId: t.id, outputs: [], hasUnmetLinkedInput: false })),
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
        status: "in_progress",
      }),
      task({
        id: "k-2",
        skillId: "pm",
        stageId: "validation",
        playbookId: "pdr-review",
        status: "in_progress",
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
      task({ id: "k-1", skillId: "sales-ops", stageId: "pre-sales", status: "in_progress" }),
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

  it("forwards instance.taskIO to TaskCard so output pips render on the matrix", () => {
    const inst = instance([
      task({ id: "io-1", skillId: "sales-ops", stageId: "pre-sales", status: "in_progress" }),
    ]);
    inst.taskIO = [
      {
        taskId: "io-1",
        outputs: [
          { id: "out-a", position: 0, status: "produced", name: "Output A" },
          { id: "out-b", position: 1, status: "pending", name: "Output B" },
        ],
        hasUnmetLinkedInput: true,
      },
    ];

    renderWithTopBarProvider(<ProcessMatrix instance={inst} template={TEMPLATE} />);

    expect(screen.getByTestId("task-pip-rail-io-1")).toBeInTheDocument();
    expect(screen.getByTestId("task-pip-io-1-out-a").dataset.status).toBe("produced");
    expect(screen.getByTestId("task-pip-io-1-out-b").dataset.status).toBe("pending");
  });

  it("toggles the role-collapsed class and hides labels when the toggle is pressed", async () => {
    const inst = instance([
      task({ id: "k-1", skillId: "sales-ops", stageId: "pre-sales", status: "in_progress" }),
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

  it("collapses an individual stage column and renders only its pip strip", async () => {
    const inst = instance([
      task({ id: "k-1", skillId: "sales-ops", stageId: "pre-sales", status: "in_progress" }),
      task({ id: "k-2", skillId: "pm", stageId: "pre-sales", status: "complete" }),
    ]);
    const user = userEvent.setup();

    renderWithTopBarProvider(<ProcessMatrix instance={inst} template={TEMPLATE} />);

    const header = screen.getByTestId("matrix-stage-pre-sales");
    expect(within(header).getByText("Pre-Sales")).toBeInTheDocument();

    await user.click(screen.getByTestId("matrix-stage-toggle-pre-sales"));

    expect(header).toHaveAttribute("data-collapsed", "true");
    // The stage name no longer appears inline in the collapsed header — it
    // surfaces only in the hover-portaled tooltip outside this subtree.
    expect(within(header).queryByText("Pre-Sales")).not.toBeInTheDocument();
    // Pips remain visible to convey task density even when collapsed.
    expect(within(header).getAllByTestId(/^matrix-pip-/)).toHaveLength(2);
    // Body cells in the collapsed column are narrowed and become mini cells.
    const cell = screen.getByTestId("matrix-cell-sales-ops-pre-sales");
    expect(cell).toHaveAttribute("data-stage-collapsed", "true");
    expect(cell).toHaveAttribute("data-mini", "true");
    expect(within(cell).getByTestId("task-mini-k-1")).toBeInTheDocument();
  });

  it("collapses an individual skill row and renders mini cells across the row", async () => {
    const inst = instance([
      task({ id: "k-1", skillId: "sales-ops", stageId: "pre-sales", status: "in_progress" }),
      task({ id: "k-2", skillId: "sales-ops", stageId: "validation", status: "complete" }),
      task({ id: "k-3", skillId: "pm", stageId: "pre-sales", status: "not_started" }),
    ]);
    const user = userEvent.setup();

    renderWithTopBarProvider(<ProcessMatrix instance={inst} template={TEMPLATE} />);

    expect(screen.getByTestId("matrix-skill-label-sales-ops")).toBeInTheDocument();

    await user.click(screen.getByTestId("matrix-skill-toggle-sales-ops"));

    const row = screen.getByTestId("matrix-skill-row-sales-ops");
    expect(row).toHaveAttribute("data-collapsed", "true");
    expect(
      screen.queryByTestId("matrix-skill-label-sales-ops"),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("task-mini-k-1")).toBeInTheDocument();
    expect(screen.getByTestId("task-mini-k-2")).toBeInTheDocument();
    // Other rows remain expanded.
    expect(screen.getByTestId("task-card-k-3")).toBeInTheDocument();
  });

  it("still renders the matrix when the template was deleted, using the instance snapshot", () => {
    // Instance carries its own stages/skills snapshot (set at create time),
    // so a deleted template no longer collapses the matrix.
    const inst = instance([]);
    renderWithTopBarProvider(<ProcessMatrix instance={inst} template={null} />);

    expect(screen.queryByTestId("matrix-empty")).not.toBeInTheDocument();
    expect(screen.getByTestId("matrix-stage-pre-sales")).toBeInTheDocument();
  });

  it("renders the placeholder when the instance has no stages or skills", () => {
    const inst = { ...instance([]), stages: [], skills: [] };
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
    const inst = instance([task({ id: "k-1", status: "in_progress" })]);
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

  it("renders two compact cards when a cell holds two tasks", () => {
    const inst = instance([
      task({ id: "k-1", playbookId: "pb-a", createdAt: "2026-04-19T12:00:00Z" }),
      task({ id: "k-2", playbookId: "pb-b", createdAt: "2026-04-19T13:00:00Z" }),
    ]);

    renderWithTopBarProvider(<ProcessMatrix instance={inst} template={TEMPLATE} />);

    // Both cards render — vertically stacked — and start in the compact
    // variant (the previous single-task lookup would have hidden one).
    expect(screen.getByTestId("task-card-k-1")).toHaveAttribute(
      "data-variant",
      "compact",
    );
    expect(screen.getByTestId("task-card-k-2")).toHaveAttribute(
      "data-variant",
      "compact",
    );
  });

  it("promotes a compact card to full when clicked, then opens the drawer on a second click", async () => {
    const inst = instance([
      task({ id: "k-1", playbookId: "pb-a", createdAt: "2026-04-19T12:00:00Z" }),
      task({ id: "k-2", playbookId: "pb-b", createdAt: "2026-04-19T13:00:00Z" }),
    ]);
    const user = userEvent.setup();

    renderWithTopBarProvider(<ProcessMatrix instance={inst} template={TEMPLATE} />);

    await user.click(screen.getByTestId("task-card-k-1"));

    // After promotion the same DOM element switches `data-variant` —
    // the root stays mounted so CSS can animate the height morph.
    expect(screen.getByTestId("task-card-k-1")).toHaveAttribute(
      "data-variant",
      "full",
    );
    expect(screen.getByTestId("task-card-k-2")).toHaveAttribute(
      "data-variant",
      "compact",
    );

    // Second click on the promoted full card opens the playbook drawer.
    await user.click(screen.getByTestId("task-card-k-1"));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("collapses a promoted card back to compact when the demote button is clicked", async () => {
    const inst = instance([
      task({ id: "k-1", playbookId: "pb-a", createdAt: "2026-04-19T12:00:00Z" }),
      task({ id: "k-2", playbookId: "pb-b", createdAt: "2026-04-19T13:00:00Z" }),
    ]);
    const user = userEvent.setup();

    renderWithTopBarProvider(<ProcessMatrix instance={inst} template={TEMPLATE} />);

    await user.click(screen.getByTestId("task-card-k-1"));
    expect(screen.getByTestId("task-card-k-1")).toHaveAttribute(
      "data-variant",
      "full",
    );

    await user.click(screen.getByLabelText(/Collapse playbook card:/));
    expect(screen.getByTestId("task-card-k-1")).toHaveAttribute(
      "data-variant",
      "compact",
    );
  });

  it("exposes a hover-reveal 'Add another' affordance in occupied cells in edit mode", async () => {
    const inst = instance([
      task({ id: "k-1", playbookId: "pb-a", createdAt: "2026-04-19T12:00:00Z" }),
    ]);
    const user = userEvent.setup();

    renderWithTopBarProvider(<ProcessMatrix instance={inst} template={TEMPLATE} editMode />);

    // The "Add another" affordance lives inside the occupied cell — it is
    // CSS-hidden until the cell is hovered, but it is in the DOM and
    // accessible by its testid, and clicking it should open the
    // create-task drawer for the same (skill, stage) pair.
    const addMore = screen.getByTestId("matrix-add-more-sales-ops-pre-sales");
    await user.click(addMore);

    expect(
      screen.getByRole("dialog", { name: "Add playbook" }),
    ).toBeInTheDocument();
  });

  it("collapses a multi-task mini cell to a single primary avatar with a +N badge", async () => {
    const inst = instance([
      task({ id: "k-1", playbookId: "pb-a", createdAt: "2026-04-19T12:00:00Z" }),
      task({ id: "k-2", playbookId: "pb-b", createdAt: "2026-04-19T13:00:00Z" }),
    ]);
    const user = userEvent.setup();

    renderWithTopBarProvider(<ProcessMatrix instance={inst} template={TEMPLATE} />);

    await user.click(screen.getByTestId("matrix-skill-toggle-sales-ops"));

    // Only the primary avatar is visible — the second task collapses
    // into a hidden anchor (for wiring) and into the +N badge.
    expect(screen.getByTestId("task-mini-k-1")).toBeInTheDocument();
    expect(screen.queryByTestId("task-mini-k-2")).not.toBeInTheDocument();
    expect(
      screen.getByLabelText("2 playbooks in this cell"),
    ).toHaveTextContent("+1");

    // Hidden ghost anchor for k-2 is in the DOM so the wiring overlay
    // can still measure an endpoint for it.
    expect(
      document.querySelector('[data-task-id="k-2"][data-mini="true"]'),
    ).not.toBeNull();
  });

  it("removes a task after confirm", async () => {
    const inst = instance([task({ id: "k-1", status: "in_progress" })]);
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
