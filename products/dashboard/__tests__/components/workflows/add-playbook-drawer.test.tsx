import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { AddPlaybookDrawer } from "@/components/workflows/add-playbook-drawer";
import { renderWithToast } from "@/tests/test-utils";
import type {
  FrameworkItem,
  TemplateOutputGroup,
  WorkflowInput,
} from "@/lib/workflows/types";

const PLAYBOOKS: FrameworkItem[] = [
  {
    id: "pb-presales",
    type: "playbook",
    name: "Presales",
    description: "",
    icon: null,
    content: "",
    allowedSkillIds: ["sk-pm"],
  },
];

const OUTPUT_GROUPS: TemplateOutputGroup[] = [
  {
    playbookId: "pb-presales",
    playbookName: "Presales",
    outputs: [
      {
        id: "po-1",
        playbookId: "pb-presales",
        name: "report",
        description: null,
        kind: "file",
        apiCheck: null,
        position: 0,
        createdAt: "2026-04-19T12:00:00Z",
      },
      {
        id: "po-2",
        playbookId: "pb-presales",
        name: "deck",
        description: null,
        kind: "media",
        apiCheck: null,
        position: 1,
        createdAt: "2026-04-19T12:00:00Z",
      },
    ],
  },
];

const UPSTREAM_TASKS = [
  { id: "task-a", label: "Presales · Pre-Sales", playbookId: "pb-presales" },
];

function renderDrawer(overrides: Partial<Parameters<typeof AddPlaybookDrawer>[0]> = {}) {
  const onSubmit = vi.fn();
  const onClose = vi.fn();
  renderWithToast(
    <AddPlaybookDrawer
      mode="edit"
      skillId="sk-pm"
      skillLabel="PM"
      stageId="pre-sales"
      stageName="Pre-Sales"
      playbooks={PLAYBOOKS}
      initial={{ playbookId: "pb-presales" }}
      upstreamTaskOptions={UPSTREAM_TASKS}
      outputGroups={OUTPUT_GROUPS}
      onClose={onClose}
      onSubmit={onSubmit}
      {...overrides}
    />,
  );
  return { onSubmit, onClose };
}

describe("AddPlaybookDrawer — inputs editor", () => {
  it("renders the inputs section with an add affordance when the task has no inputs", () => {
    renderDrawer();
    const addBtn = screen.getByTestId("add-input-row-trigger");
    expect(addBtn).toBeInTheDocument();
    expect(addBtn).toHaveTextContent(/Add input/i);
    // Empty state has no other input rows.
    expect(screen.queryByTestId("input-row-0")).toBeNull();
  });

  it("adds an input row, picks a playbook output via the styled picker, and submits the wiring with a derived name", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderDrawer();

    await user.click(screen.getByTestId("add-input-row-trigger"));

    // The inline "+ Add input" trigger opens the picker dropdown directly.
    const dropdown = await screen.findByTestId(
      "add-input-row-dropdown",
    );
    await user.click(
      within(dropdown).getByTestId("add-input-row-item-po-1"),
    );

    // Selection adds a static list item with the wired playbook · output
    // combo; the inline "+ Add input" trigger stays put for the next pick.
    const row = screen.getByTestId("input-row-0");
    expect(row).toHaveTextContent(/Presales/);
    expect(row).toHaveTextContent(/report/);

    await user.click(screen.getByRole("button", { name: /Save playbook/i }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const submitted = onSubmit.mock.calls[0][0] as { inputs: WorkflowInput[] };
    expect(submitted.inputs).toHaveLength(1);
    expect(submitted.inputs[0]).toMatchObject({
      upstreamOutputId: "po-1",
      upstreamTaskRef: "task-a",
    });
  });

  it("trashing an existing wired input drops it from the submitted inputs", async () => {
    const user = userEvent.setup();
    const wired: WorkflowInput[] = [
      {
        id: "in-1",
        upstreamTaskRef: "task-a",
        upstreamOutputId: "po-1",
      },
    ];
    const { onSubmit } = renderDrawer({
      initial: { playbookId: "pb-presales", inputs: wired },
    });

    const row = screen.getByTestId("input-row-0");
    expect(row).toHaveTextContent(/Presales/);

    await user.click(within(row).getByTestId("input-row-0-delete"));
    expect(screen.queryByTestId("input-row-0")).toBeNull();

    await user.click(screen.getByRole("button", { name: /Save playbook/i }));

    const submitted = onSubmit.mock.calls[0][0] as { inputs: WorkflowInput[] };
    expect(submitted.inputs).toHaveLength(0);
  });

  it("removes an input row via the delete button", async () => {
    const user = userEvent.setup();
    const wired: WorkflowInput[] = [
      {
        id: "in-1",
        upstreamTaskRef: "task-a",
        upstreamOutputId: "po-1",
      },
    ];
    const { onSubmit } = renderDrawer({
      initial: { playbookId: "pb-presales", inputs: wired },
    });

    await user.click(screen.getByTestId("input-row-0-delete"));
    expect(screen.queryByTestId("input-row-0")).toBeNull();

    await user.click(screen.getByRole("button", { name: /Save playbook/i }));
    const submitted = onSubmit.mock.calls[0][0] as { inputs: WorkflowInput[] };
    expect(submitted.inputs).toHaveLength(0);
  });
});
