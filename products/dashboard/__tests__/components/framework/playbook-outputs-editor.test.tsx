import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PlaybookOutputsEditor } from "@/components/framework/playbook-outputs-editor";
import { renderWithToast } from "@/tests/test-utils";
import type { PlaybookOutput } from "@/lib/workflows/types";

const listMock = vi.fn();
const createMock = vi.fn();
const updateMock = vi.fn();
const deleteMock = vi.fn();
const reorderMock = vi.fn();
const countMock = vi.fn();

vi.mock("@/app/(dashboard)/framework/actions", () => ({
  listPlaybookOutputsAction: (...args: unknown[]) => listMock(...args),
  createPlaybookOutputAction: (...args: unknown[]) => createMock(...args),
  updatePlaybookOutputAction: (...args: unknown[]) => updateMock(...args),
  deletePlaybookOutputAction: (...args: unknown[]) => deleteMock(...args),
  reorderPlaybookOutputsAction: (...args: unknown[]) => reorderMock(...args),
  countTaskOutputsForPlaybookOutputAction: (...args: unknown[]) => countMock(...args),
}));

const fixture = (overrides: Partial<PlaybookOutput> = {}): PlaybookOutput => ({
  id: "po-1",
  playbookId: "pb-presales",
  name: "report",
  description: "Initial report",
  kind: "file",
  apiCheck: null,
  position: 0,
  createdAt: "2026-04-19T12:00:00Z",
  ...overrides,
});

describe("PlaybookOutputsEditor", () => {
  beforeEach(() => {
    listMock.mockReset();
    createMock.mockReset();
    updateMock.mockReset();
    deleteMock.mockReset();
    reorderMock.mockReset();
    countMock.mockReset();
  });

  it("renders existing outputs from initialOutputs", () => {
    renderWithToast(
      <PlaybookOutputsEditor
        playbookId="pb-presales"
        initialOutputs={[fixture(), fixture({ id: "po-2", name: "deck", kind: "media", position: 1 })]}
      />,
    );

    expect(screen.getByTestId("playbook-output-name-view-po-1")).toHaveTextContent("report");
    expect(screen.getByTestId("playbook-output-name-view-po-2")).toHaveTextContent("deck");
    expect(listMock).not.toHaveBeenCalled();
  });

  it("loads outputs on mount when initialOutputs is omitted", async () => {
    listMock.mockResolvedValueOnce([fixture()]);

    renderWithToast(<PlaybookOutputsEditor playbookId="pb-presales" />);

    await waitFor(() => expect(listMock).toHaveBeenCalledWith("pb-presales"));
    expect(
      await screen.findByTestId("playbook-output-name-view-po-1"),
    ).toHaveTextContent("report");
  });

  it("adds a new output via createPlaybookOutputAction", async () => {
    const user = userEvent.setup();
    createMock.mockResolvedValueOnce(
      fixture({ id: "po-new", name: "summary", kind: "manual", position: 1 }),
    );

    renderWithToast(
      <PlaybookOutputsEditor playbookId="pb-presales" initialOutputs={[fixture()]} />,
    );

    await user.click(screen.getByTestId("playbook-outputs-add"));

    const newRow = screen.getAllByRole("listitem").at(-1)!;
    const nameInput = within(newRow).getByLabelText("Output name");
    await user.type(nameInput, "summary");

    const kindSelect = within(newRow).getByLabelText("Output kind");
    await user.selectOptions(kindSelect, "manual");

    await user.click(within(newRow).getByRole("button", { name: "Add" }));

    await waitFor(() =>
      expect(createMock).toHaveBeenCalledWith({
        playbookId: "pb-presales",
        name: "summary",
        description: null,
        kind: "manual",
        apiCheck: null,
      }),
    );
  });

  it("dispatches updatePlaybookOutputAction when an existing row's name changes", async () => {
    const user = userEvent.setup();
    updateMock.mockResolvedValueOnce(fixture({ name: "report-v2" }));

    renderWithToast(
      <PlaybookOutputsEditor playbookId="pb-presales" initialOutputs={[fixture()]} />,
    );

    await user.click(screen.getByTestId("playbook-output-edit-po-1"));
    const nameInput = screen.getByDisplayValue("report");
    await user.clear(nameInput);
    await user.type(nameInput, "report-v2");

    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(updateMock).toHaveBeenCalledWith("po-1", {
        name: "report-v2",
        description: "Initial report",
        kind: "file",
        apiCheck: null,
      }),
    );
  });

  it("blocks duplicate names client-side and surfaces an inline error", async () => {
    const user = userEvent.setup();

    renderWithToast(
      <PlaybookOutputsEditor
        playbookId="pb-presales"
        initialOutputs={[fixture(), fixture({ id: "po-2", name: "deck", position: 1 })]}
      />,
    );

    await user.click(screen.getByTestId("playbook-output-edit-po-2"));
    const deckInput = screen.getByDisplayValue("deck");
    await user.clear(deckInput);
    await user.type(deckInput, "report");

    const saveButton = within(deckInput.closest("li")!).getByRole("button", {
      name: "Save",
    });
    await user.click(saveButton);

    expect(updateMock).not.toHaveBeenCalled();
    expect(
      await screen.findByTestId("playbook-output-error-po-2"),
    ).toHaveTextContent(/unique/i);
  });

  it("shows the cascade-impact line in the confirm modal when task_outputs reference the row", async () => {
    const user = userEvent.setup();
    countMock.mockResolvedValueOnce(3);

    renderWithToast(
      <PlaybookOutputsEditor playbookId="pb-presales" initialOutputs={[fixture()]} />,
    );

    await user.click(screen.getByTestId("playbook-output-delete-po-1"));

    await waitFor(() =>
      expect(countMock).toHaveBeenCalledWith("po-1"),
    );
    const impact = await screen.findByTestId("playbook-outputs-delete-impact");
    expect(impact).toHaveTextContent(/3 task output rows/i);
  });

  it("removes a pending (unsaved) row locally without calling delete", async () => {
    const user = userEvent.setup();

    renderWithToast(
      <PlaybookOutputsEditor playbookId="pb-presales" initialOutputs={[fixture()]} />,
    );

    await user.click(screen.getByTestId("playbook-outputs-add"));
    const rows = screen.getAllByRole("listitem");
    const pendingRow = rows.at(-1)!;
    const pendingDelete = within(pendingRow).getByRole("button", { name: "Delete" });
    await user.click(pendingDelete);

    expect(deleteMock).not.toHaveBeenCalled();
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
  });
});
