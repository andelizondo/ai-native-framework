import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { TemplateEditorScreen } from "@/components/workflows/template-editor-screen";
import type { WorkflowTemplate } from "@/lib/workflows/types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

vi.mock("@/app/(dashboard)/workflows/actions", () => ({
  updateTemplateAction: vi.fn(),
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

vi.mock("@/lib/events", () => ({
  emitEvent: vi.fn(),
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
    { id: "sales", label: "Sales", owner: "Hans / Dave", color: "#7dd3fc" },
    { id: "product", label: "Product", owner: "Andres", color: "#f9a8d4" },
  ],
  taskTemplates: [],
  createdAt: "2026-04-19T12:00:00Z",
  updatedAt: "2026-04-19T12:00:00Z",
};

describe("TemplateEditorScreen", () => {
  it("renders insert affordances between and after existing headers", () => {
    render(
      <TemplateEditorScreen
        template={TEMPLATE}
        skillOptions={[]}
        playbookOptions={[]}
      />,
    );

    expect(screen.getByLabelText("Add stage after Pre-Sales")).toBeInTheDocument();
    expect(screen.getByLabelText("Add stage after Validation")).toBeInTheDocument();
    expect(screen.getByLabelText("Add role after Sales")).toBeInTheDocument();
    expect(screen.getByLabelText("Add role after Product")).toBeInTheDocument();
    expect(screen.getByLabelText("Template editing information")).toHaveAttribute(
      "aria-describedby",
      "template-editor-help",
    );
    expect(screen.getByRole("tooltip")).toHaveAttribute("id", "template-editor-help");
  });

  it("renders empty-state affordances when stages or roles are missing", () => {
    render(
      <TemplateEditorScreen
        template={{ ...TEMPLATE, stages: [], roles: [] }}
        skillOptions={[]}
        playbookOptions={[]}
      />,
    );

    expect(screen.getByText("Add first stage")).toBeInTheDocument();
    expect(screen.getByText("Add first role")).toBeInTheDocument();
  });
});
