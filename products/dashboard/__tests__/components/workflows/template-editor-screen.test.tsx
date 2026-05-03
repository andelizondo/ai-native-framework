import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { TemplateEditorScreen } from "@/components/workflows/template-editor-screen";
import { renderWithToast } from "@/tests/test-utils";
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
  skills: [
    { id: "sales-ops", label: "Sales Ops", owners: ["Hans / Dave"] },
    { id: "pm", label: "PM", owners: ["Andres"] },
  ],
  taskTemplates: [],
  createdAt: "2026-04-19T12:00:00Z",
  updatedAt: "2026-04-19T12:00:00Z",
};

describe("TemplateEditorScreen", () => {
  it("renders insert affordances between and after existing headers", () => {
    renderWithToast(
      <TemplateEditorScreen
        template={TEMPLATE}
        instanceCount={0}
        skillOptions={[]}
        playbookOptions={[]}
      />,
    );

    expect(screen.getByLabelText("Add stage after Pre-Sales")).toBeInTheDocument();
    expect(screen.getByLabelText("Add stage after Validation")).toBeInTheDocument();
    expect(screen.getByLabelText("Add skill after Sales Ops")).toBeInTheDocument();
    expect(screen.getByLabelText("Add skill after PM")).toBeInTheDocument();
    expect(screen.getByLabelText("Template editing information")).toHaveAttribute(
      "aria-describedby",
      "template-editor-help",
    );
    expect(screen.getByRole("tooltip")).toHaveAttribute("id", "template-editor-help");
  });

  it("renders empty-state affordances when stages or roles are missing", () => {
    renderWithToast(
      <TemplateEditorScreen
        template={{ ...TEMPLATE, stages: [], skills: [] }}
        instanceCount={0}
        skillOptions={[]}
        playbookOptions={[]}
      />,
    );

    expect(screen.getByText("Add first stage")).toBeInTheDocument();
    expect(screen.getByText("Add first skill")).toBeInTheDocument();
  });
});
