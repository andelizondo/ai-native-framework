import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PlaybookMetadataDock } from "@/components/framework/playbook-metadata-dock";
import { renderWithToast } from "@/tests/test-utils";
import type {
  PlaybookInput,
  PlaybookOutput,
  TemplateOutputGroup,
} from "@/lib/workflows/types";

const listOutputsMock = vi.fn();
const createOutputMock = vi.fn();
const updateOutputMock = vi.fn();
const deleteOutputMock = vi.fn();
const reorderOutputsMock = vi.fn();
const countMock = vi.fn();
const listInputsMock = vi.fn();
const createInputMock = vi.fn();
const deleteInputMock = vi.fn();
const reorderInputsMock = vi.fn();
const listOtherOutputsMock = vi.fn();

vi.mock("@/app/(dashboard)/framework/actions", () => ({
  listPlaybookOutputsAction: (...args: unknown[]) => listOutputsMock(...args),
  createPlaybookOutputAction: (...args: unknown[]) => createOutputMock(...args),
  updatePlaybookOutputAction: (...args: unknown[]) => updateOutputMock(...args),
  deletePlaybookOutputAction: (...args: unknown[]) => deleteOutputMock(...args),
  reorderPlaybookOutputsAction: (...args: unknown[]) => reorderOutputsMock(...args),
  countTaskOutputsForPlaybookOutputAction: (...args: unknown[]) => countMock(...args),
  listPlaybookInputsAction: (...args: unknown[]) => listInputsMock(...args),
  createPlaybookInputAction: (...args: unknown[]) => createInputMock(...args),
  deletePlaybookInputAction: (...args: unknown[]) => deleteInputMock(...args),
  reorderPlaybookInputsAction: (...args: unknown[]) => reorderInputsMock(...args),
  listOutputGroupsForOtherPlaybooksAction: (...args: unknown[]) =>
    listOtherOutputsMock(...args),
}));

const outputFixture = (overrides: Partial<PlaybookOutput> = {}): PlaybookOutput => ({
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

const inputFixture = (overrides: Partial<PlaybookInput> = {}): PlaybookInput => ({
  id: "pi-1",
  playbookId: "pb-presales",
  upstreamOutputId: "po-up-1",
  position: 0,
  createdAt: "2026-04-19T12:00:00Z",
  upstreamOutputName: "brief",
  upstreamOutputKind: "file",
  upstreamPlaybookId: "pb-marketing",
  upstreamPlaybookName: "marketing-brief",
  ...overrides,
});

const groupFixture = (
  overrides: Partial<TemplateOutputGroup> = {},
): TemplateOutputGroup => ({
  playbookId: "pb-marketing",
  playbookName: "marketing-brief",
  outputs: [
    {
      id: "po-up-1",
      playbookId: "pb-marketing",
      name: "brief",
      description: null,
      kind: "file",
      apiCheck: null,
      position: 0,
      createdAt: "2026-04-19T12:00:00Z",
    },
    {
      id: "po-up-2",
      playbookId: "pb-marketing",
      name: "outreach-list",
      description: null,
      kind: "file",
      apiCheck: null,
      position: 1,
      createdAt: "2026-04-19T12:00:00Z",
    },
  ],
  ...overrides,
});

describe("PlaybookMetadataDock", () => {
  beforeEach(() => {
    listOutputsMock.mockReset();
    createOutputMock.mockReset();
    updateOutputMock.mockReset();
    deleteOutputMock.mockReset();
    reorderOutputsMock.mockReset();
    countMock.mockReset();
    listInputsMock.mockReset();
    createInputMock.mockReset();
    deleteInputMock.mockReset();
    reorderInputsMock.mockReset();
    listOtherOutputsMock.mockReset();
    listOtherOutputsMock.mockResolvedValue([groupFixture()]);
  });

  it("renders both Inputs and Outputs sections", async () => {
    renderWithToast(
      <PlaybookMetadataDock
        playbookId="pb-presales"
        initialInputs={[inputFixture()]}
        initialOutputs={[outputFixture()]}
      />,
    );

    expect(screen.getByText("Inputs")).toBeInTheDocument();
    expect(screen.getByText("Outputs")).toBeInTheDocument();
    // Input row shows "Playbook / Output" labels from the hydration.
    expect(screen.getByText("marketing-brief")).toBeInTheDocument();
    expect(screen.getByText("brief")).toBeInTheDocument();
    expect(screen.getByText("report")).toBeInTheDocument();
    expect(listInputsMock).not.toHaveBeenCalled();
    expect(listOutputsMock).not.toHaveBeenCalled();
    // Catalog is always fetched so the picker is populated.
    await waitFor(() =>
      expect(listOtherOutputsMock).toHaveBeenCalledWith("pb-presales"),
    );
  });

  it("loads both lists on mount when initial props are omitted", async () => {
    listInputsMock.mockResolvedValueOnce([inputFixture()]);
    listOutputsMock.mockResolvedValueOnce([outputFixture()]);

    renderWithToast(<PlaybookMetadataDock playbookId="pb-presales" />);

    await waitFor(() => expect(listInputsMock).toHaveBeenCalledWith("pb-presales"));
    await waitFor(() => expect(listOutputsMock).toHaveBeenCalledWith("pb-presales"));
    expect(await screen.findByText("marketing-brief")).toBeInTheDocument();
    expect(await screen.findByText("report")).toBeInTheDocument();
  });

  it("adds an input by picking an upstream output from the dropdown", async () => {
    const user = userEvent.setup();
    createInputMock.mockResolvedValueOnce(
      inputFixture({ id: "pi-new", upstreamOutputId: "po-up-2", position: 1,
        upstreamOutputName: "outreach-list" }),
    );

    renderWithToast(
      <PlaybookMetadataDock
        playbookId="pb-presales"
        initialInputs={[]}
        initialOutputs={[]}
      />,
    );

    // Wait for the catalog fetch to resolve so the picker has options.
    await waitFor(() => expect(listOtherOutputsMock).toHaveBeenCalled());

    await user.click(screen.getByTestId("playbook-inputs-add-trigger"));
    await user.click(
      await screen.findByTestId("playbook-inputs-add-item-po-up-2"),
    );

    await waitFor(() =>
      expect(createInputMock).toHaveBeenCalledWith({
        playbookId: "pb-presales",
        upstreamOutputId: "po-up-2",
      }),
    );
  });

  it("removes a persisted input after confirmation", async () => {
    const user = userEvent.setup();
    deleteInputMock.mockResolvedValueOnce(undefined);

    renderWithToast(
      <PlaybookMetadataDock
        playbookId="pb-presales"
        initialInputs={[inputFixture()]}
        initialOutputs={[]}
      />,
    );

    await user.click(screen.getByTestId("playbook-input-delete-pi-1"));
    await user.click(screen.getByRole("button", { name: "Remove" }));

    await waitFor(() => expect(deleteInputMock).toHaveBeenCalledWith("pi-1"));
  });
});
