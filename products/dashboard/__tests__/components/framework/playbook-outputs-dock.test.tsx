import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PlaybookOutputsDock } from "@/components/framework/playbook-metadata-dock";
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

/** Open the inline-edit name input for a given row testid by clicking
 *  the read-mode button rendered by `InlineEditableText`. */
async function focusName(user: ReturnType<typeof userEvent.setup>, rowId: string) {
  const row = screen.getByTestId(`playbook-output-row-${rowId}`);
  await user.click(within(row).getByRole("button", { name: /edit output name/i }));
  return within(row).getByLabelText("Output name") as HTMLInputElement;
}

describe("PlaybookOutputsDock", () => {
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
      <PlaybookOutputsDock
        playbookId="pb-presales"
        initialOutputs={[
          fixture(),
          fixture({ id: "po-2", name: "deck", kind: "media", position: 1 }),
        ]}
      />,
    );

    expect(screen.getByText("report")).toBeInTheDocument();
    expect(screen.getByText("deck")).toBeInTheDocument();
    expect(listMock).not.toHaveBeenCalled();
  });

  it("loads outputs on mount when initialOutputs is omitted", async () => {
    listMock.mockResolvedValueOnce([fixture()]);

    renderWithToast(<PlaybookOutputsDock playbookId="pb-presales" />);

    await waitFor(() => expect(listMock).toHaveBeenCalledWith("pb-presales"));
    expect(await screen.findByText("report")).toBeInTheDocument();
  });

  it("adds a new output via createPlaybookOutputAction", async () => {
    const user = userEvent.setup();
    createMock.mockResolvedValueOnce(
      fixture({ id: "po-new", name: "summary", kind: "manual", position: 1 }),
    );

    renderWithToast(
      <PlaybookOutputsDock playbookId="pb-presales" initialOutputs={[fixture()]} />,
    );

    await user.click(screen.getByTestId("playbook-outputs-add"));

    const outputRows = screen
      .getAllByRole("listitem")
      .filter((el) => el.dataset.testid?.startsWith("playbook-output-row-"));
    const newRow = outputRows.at(-1)!;
    // Type the name into the inline-editable field.
    await user.click(within(newRow).getByRole("button", { name: /edit output name/i }));
    const nameInput = within(newRow).getByLabelText("Output name") as HTMLInputElement;
    await user.type(nameInput, "summary");
    await user.tab(); // commit via blur

    // Change kind from the default ("file") to "manual" via the avatar picker.
    await user.click(
      within(newRow).getByRole("button", { name: /output kind/i }),
    );
    await user.click(
      within(newRow).getByRole("option", { name: /manual/i }),
    );

    await user.click(within(newRow).getByRole("button", { name: "Save" }));

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
      <PlaybookOutputsDock playbookId="pb-presales" initialOutputs={[fixture()]} />,
    );

    const nameInput = await focusName(user, "po-1");
    await user.clear(nameInput);
    await user.type(nameInput, "report-v2");
    await user.tab(); // commit

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
      <PlaybookOutputsDock
        playbookId="pb-presales"
        initialOutputs={[fixture(), fixture({ id: "po-2", name: "deck", position: 1 })]}
      />,
    );

    const deckInput = await focusName(user, "po-2");
    await user.clear(deckInput);
    await user.type(deckInput, "report");
    await user.tab();

    const row = screen.getByTestId("playbook-output-row-po-2");
    await user.click(within(row).getByRole("button", { name: "Save" }));

    expect(updateMock).not.toHaveBeenCalled();
    expect(
      await screen.findByTestId("playbook-output-error-po-2"),
    ).toHaveTextContent(/unique/i);
  });

  it("shows the cascade-impact line in the confirm modal when task_outputs reference the row", async () => {
    const user = userEvent.setup();
    countMock.mockResolvedValueOnce(3);

    renderWithToast(
      <PlaybookOutputsDock playbookId="pb-presales" initialOutputs={[fixture()]} />,
    );

    await user.click(screen.getByTestId("playbook-output-delete-po-1"));

    await waitFor(() => expect(countMock).toHaveBeenCalledWith("po-1"));
    const impact = await screen.findByTestId("playbook-outputs-delete-impact");
    expect(impact).toHaveTextContent(/3 produced task output rows/i);
  });

  it("removes a pending (unsaved) row locally without calling delete", async () => {
    const user = userEvent.setup();

    renderWithToast(
      <PlaybookOutputsDock playbookId="pb-presales" initialOutputs={[fixture()]} />,
    );

    await user.click(screen.getByTestId("playbook-outputs-add"));
    const rows = screen
      .getAllByRole("listitem")
      .filter((el) => el.dataset.testid?.startsWith("playbook-output-row-"));
    const pendingRow = rows.at(-1)!;
    await user.click(
      within(pendingRow).getByRole("button", { name: /delete output/i }),
    );

    expect(deleteMock).not.toHaveBeenCalled();
    expect(
      screen
        .getAllByRole("listitem")
        .filter((el) => el.dataset.testid?.startsWith("playbook-output-row-")),
    ).toHaveLength(1);
  });
});
