import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { AddPlaybookModal } from "@/components/workflows/add-playbook-modal";
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
  {
    playbookId: "pb-empty",
    playbookName: "Empty",
    outputs: [],
  },
];

const UPSTREAM_TASKS = [
  { id: "task-a", label: "Presales · Pre-Sales" },
  { id: "task-b", label: "Empty · Validation" },
];

function renderModal(overrides: Partial<Parameters<typeof AddPlaybookModal>[0]> = {}) {
  const onSubmit = vi.fn();
  const onClose = vi.fn();
  renderWithToast(
    <AddPlaybookModal
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

describe("AddPlaybookModal — inputs editor", () => {
  it("renders an empty-state placeholder when the task has no inputs", () => {
    renderModal();
    expect(screen.getByText(/No inputs declared/i)).toBeInTheDocument();
  });

  it("adds an input row, picks a playbook, then an output, and submits the wiring", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderModal();

    await user.click(screen.getByTestId("add-input-row"));

    const row = screen.getByTestId("input-row-0");
    await user.type(within(row).getByLabelText("Input name"), "After PD");

    // Step 1: pick the playbook.
    await user.selectOptions(
      within(row).getByLabelText("From playbook"),
      "pb-presales",
    );
    // Step 2: pick the output.
    await user.selectOptions(within(row).getByLabelText("Output"), "po-1");

    // Wired chip appears with the "Output:" prefix and × clear.
    expect(within(row).getByTestId("input-wiring-chip")).toHaveTextContent(
      /Output:.*Presales.*report/,
    );

    await user.click(screen.getByRole("button", { name: /Save playbook/i }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const submitted = onSubmit.mock.calls[0][0] as {
      inputs: WorkflowInput[];
    };
    expect(submitted.inputs).toHaveLength(1);
    expect(submitted.inputs[0]).toMatchObject({
      name: "After PD",
      linkMode: "linked",
      upstreamOutputId: "po-1",
    });
  });

  it("clearing the wiring resets upstreamOutputId to null while preserving the row", async () => {
    const user = userEvent.setup();
    const wired: WorkflowInput[] = [
      {
        id: "in-1",
        name: "After PD",
        linkMode: "linked",
        upstreamTaskRef: "task-a",
        upstreamOutputId: "po-1",
      },
    ];
    const { onSubmit } = renderModal({ initial: { playbookId: "pb-presales", inputs: wired } });

    const row = screen.getByTestId("input-row-0");
    expect(within(row).getByTestId("input-wiring-chip")).toBeInTheDocument();

    await user.click(within(row).getByLabelText("Clear wiring"));

    // Chip is gone; the From-playbook select reappears.
    expect(within(row).queryByTestId("input-wiring-chip")).toBeNull();
    expect(within(row).getByLabelText("From playbook")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Save playbook/i }));
    const submitted = onSubmit.mock.calls[0][0] as { inputs: WorkflowInput[] };
    expect(submitted.inputs[0].upstreamOutputId).toBeNull();
    expect(submitted.inputs[0].upstreamTaskRef).toBe("task-a");
  });

  it("renders the (no output wired) hint when only an upstream task is selected", () => {
    const partial: WorkflowInput[] = [
      {
        id: "in-1",
        name: "After PD",
        linkMode: "linked",
        upstreamTaskRef: "task-a",
        upstreamOutputId: null,
      },
    ];
    renderModal({ initial: { playbookId: "pb-presales", inputs: partial } });
    expect(screen.getByText("(no output wired)")).toBeInTheDocument();
  });

  it("renders the Declare-an-output CTA when the chosen playbook has zero outputs", async () => {
    const user = userEvent.setup();
    renderModal();
    await user.click(screen.getByTestId("add-input-row"));
    const row = screen.getByTestId("input-row-0");
    await user.selectOptions(within(row).getByLabelText("From playbook"), "pb-empty");
    expect(within(row).getByText(/Declare an output on this playbook/i)).toBeInTheDocument();
  });
});
