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
  it("sizes insert-role rows to the role and stage columns only", () => {
    render(
      <TemplateEditorScreen
        template={TEMPLATE}
        skillOptions={[]}
        playbookOptions={[]}
      />,
    );

    expect(screen.getByTestId("matrix-insert-role-1")).toHaveStyle({
      width: "562px",
    });
    expect(screen.getByTestId("matrix-insert-role-end")).toHaveStyle({
      width: "562px",
    });
  });
});
