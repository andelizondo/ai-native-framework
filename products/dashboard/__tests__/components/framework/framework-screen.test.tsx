import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { FrameworkScreen } from "@/components/framework/framework-screen";
import type { FrameworkItem } from "@/lib/workflows/types";

vi.mock("@/app/(dashboard)/framework/actions", () => ({
  deleteFrameworkItemAction: vi.fn(),
  upsertFrameworkItemAction: vi.fn(),
}));

vi.mock("@/components/dashboard-topbar-context", () => ({
  useDashboardTopBar: () => ({
    setConfig: vi.fn(),
  }),
}));

vi.mock("@/lib/analytics/events", () => ({
  useAnalytics: () => ({
    capture: vi.fn(),
  }),
}));

const ITEMS: FrameworkItem[] = [
  {
    id: "sk-developer",
    type: "skill",
    name: "Developer",
    description: "Implements the smallest coherent change.",
    icon: "🛠️",
    content: "# Developer\n\n- Implements code\n- Validates changes",
  },
];

describe("FrameworkScreen", () => {
  it("shows rendered markdown by default and editable plain text on toggle", async () => {
    const user = userEvent.setup();

    render(<FrameworkScreen initialItems={ITEMS} type="skill" />);

    await user.click(screen.getByTestId("framework-card-sk-developer"));

    const preview = screen.getByTestId("framework-markdown-preview-skill");
    expect(preview).toBeInTheDocument();
    expect(within(preview).getByRole("heading", { name: "Developer" })).toBeInTheDocument();
    expect(preview).toHaveTextContent("Implements code");
    expect(preview).toHaveTextContent("Validates changes");

    await user.click(screen.getByRole("tab", { name: "Edit" }));

    const editor = screen.getByTestId("framework-editor-skill");
    expect(screen.queryByTestId("framework-markdown-preview-skill")).not.toBeInTheDocument();
    expect(editor).toBeInTheDocument();
    expect(editor).toHaveValue("# Developer\n\n- Implements code\n- Validates changes");

    await user.click(screen.getByRole("tab", { name: "View" }));

    expect(screen.getByTestId("framework-markdown-preview-skill")).toBeInTheDocument();
  });

  it("applies markdown formatting from the editor toolbar", async () => {
    const user = userEvent.setup();

    render(<FrameworkScreen initialItems={ITEMS} type="skill" />);

    await user.click(screen.getByTestId("framework-card-sk-developer"));
    await user.click(screen.getByRole("tab", { name: "Edit" }));

    const editor = screen.getByTestId("framework-editor-skill") as HTMLTextAreaElement;
    const selectedText = "Implements code";
    const start = editor.value.indexOf(selectedText);
    const end = start + selectedText.length;

    editor.focus();
    editor.setSelectionRange(start, end);

    await user.click(screen.getByRole("button", { name: "Bold" }));

    expect(editor).toHaveValue("# Developer\n\n- **Implements code**\n- Validates changes");
  });
});
