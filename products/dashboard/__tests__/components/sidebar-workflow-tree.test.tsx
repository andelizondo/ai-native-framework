/**
 * Component test for components/workflows/sidebar-workflow-tree.tsx.
 * Spec anchor: AEL-48 — Workflow tree + create-instance modal.
 *
 * Covers:
 *   - Workflow tree renders one section per template, expanded by default,
 *     with the count pill reflecting instance count.
 *   - Each instance gets a navigable link to /workflows/{id}.
 *   - Clicking "+ New instance" opens the create-instance modal scoped to
 *     the clicked template, the create button is disabled until a label
 *     is typed, and submitting calls the server action, captures the
 *     `workflow.instance_created` analytics event, and navigates to the
 *     new instance's detail page.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRouter } from "next/navigation";
import posthog from "posthog-js";

import type { WorkflowTemplate } from "@/lib/workflows/types";

const { mockCreateInstanceAction } = vi.hoisted(() => ({
  mockCreateInstanceAction: vi.fn(),
}));

vi.mock("@/app/(dashboard)/workflows/actions", () => ({
  createInstanceAction: mockCreateInstanceAction,
}));

import { SidebarWorkflowTree } from "@/components/workflows/sidebar-workflow-tree";
import { renderWithToast } from "@/tests/test-utils";

const TEMPLATE_A: WorkflowTemplate = {
  id: "client-delivery",
  label: "Client Project Delivery",
  color: "#6366f1",
  multiInstance: true,
  stages: [
    { id: "pre-sales", label: "Pre-Sales" },
    { id: "validation", label: "Validation" },
  ],
  roles: [
    { id: "sales", label: "Sales" },
    { id: "product", label: "Product" },
  ],
  taskTemplates: [
    { role: "sales", stage: "pre-sales", title: "Project Description" },
    { role: "product", stage: "validation", title: "PDR Review" },
  ],
  createdAt: "2026-04-19T12:00:00Z",
  updatedAt: "2026-04-19T12:00:00Z",
};

const TEMPLATE_B: WorkflowTemplate = {
  id: "product-dev",
  label: "Product Development",
  color: "#10b981",
  multiInstance: false,
  stages: [],
  roles: [],
  taskTemplates: [],
  createdAt: "2026-04-19T12:00:00Z",
  updatedAt: "2026-04-19T12:00:00Z",
};

describe("SidebarWorkflowTree", () => {
  const pushSpy = vi.fn();

  beforeEach(() => {
    mockCreateInstanceAction.mockReset();
    pushSpy.mockReset();
    vi.mocked(posthog.capture).mockClear();
    vi.mocked(useRouter).mockReturnValue({
      push: pushSpy,
      replace: vi.fn(),
      back: vi.fn(),
      forward: vi.fn(),
      refresh: vi.fn(),
      prefetch: vi.fn(),
    });
  });

  it("falls back to the empty state placeholder when there are no templates", () => {
    renderWithToast(
      <SidebarWorkflowTree templates={[]} instancesByTemplate={{}} />,
    );
    expect(screen.getByTestId("sidebar-workflows-empty")).toBeInTheDocument();
  });

  it("renders one section per template with an instance count and per-instance links", () => {
    renderWithToast(
      <SidebarWorkflowTree
        templates={[TEMPLATE_A, TEMPLATE_B]}
        instancesByTemplate={{
          "client-delivery": [
            {
              id: "inst-1",
              templateId: "client-delivery",
              label: "Acme Corp",
              status: "active",
              roles: TEMPLATE_A.roles,
              createdAt: "2026-04-19T12:00:00Z",
              updatedAt: "2026-04-19T12:00:00Z",
            },
            {
              id: "inst-2",
              templateId: "client-delivery",
              label: "Globex Co",
              status: "not_started",
              roles: TEMPLATE_A.roles,
              createdAt: "2026-04-19T12:00:00Z",
              updatedAt: "2026-04-19T12:00:00Z",
            },
          ],
        }}
      />,
    );

    expect(screen.getByText("Client Project Delivery")).toBeInTheDocument();
    expect(screen.getByText("Product Development")).toBeInTheDocument();

    // Default-expanded → instance links are visible
    expect(
      screen.getByTestId("workflow-instance-link-inst-1"),
    ).toHaveAttribute("href", "/workflows/inst-1");
    expect(
      screen.getByTestId("workflow-instance-link-inst-2"),
    ).toHaveAttribute("href", "/workflows/inst-2");

    // Count pill shows instance count for the populated template
    expect(
      screen.getByTestId("workflow-template-count-client-delivery"),
    ).toHaveTextContent("2");
  });

  it("opens the create-instance modal scoped to the clicked template", async () => {
    const user = userEvent.setup();
    renderWithToast(
      <SidebarWorkflowTree
        templates={[TEMPLATE_A]}
        instancesByTemplate={{ "client-delivery": [] }}
      />,
    );

    await user.click(screen.getByTestId("workflow-new-instance-client-delivery"));

    const modal = await screen.findByTestId("create-instance-modal");
    expect(modal).toBeInTheDocument();
    expect(
      screen.getByRole("dialog", { name: /new client project delivery instance/i }),
    ).toBeInTheDocument();
    // The "N stages · N roles · N tasks" line reflects the scoped template
    expect(screen.getByTestId("create-instance-info")).toHaveTextContent(
      /2 stages.*2 roles.*2 tasks/i,
    );
  });

  it("disables Create until the label is non-empty, then submits, captures, and navigates", async () => {
    const user = userEvent.setup();
    mockCreateInstanceAction.mockResolvedValue({
      instance: {
        id: "inst-new",
        templateId: "client-delivery",
        label: "Acme Corp",
        status: "active",
        roles: TEMPLATE_A.roles,
        createdAt: "2026-04-19T12:00:00Z",
        updatedAt: "2026-04-19T12:00:00Z",
      },
    });

    renderWithToast(
      <SidebarWorkflowTree
        templates={[TEMPLATE_A]}
        instancesByTemplate={{ "client-delivery": [] }}
      />,
    );

    await user.click(screen.getByTestId("workflow-new-instance-client-delivery"));

    const create = screen.getByRole("button", { name: /^create\s*→?$/i });
    expect(create).toBeDisabled();

    const input = screen.getByRole("textbox", { name: /instance name/i });
    await user.type(input, "  Acme Corp  ");
    expect(create).toBeEnabled();

    await user.click(create);

    await waitFor(() =>
      expect(mockCreateInstanceAction).toHaveBeenCalledWith(
        "client-delivery",
        "Acme Corp",
      ),
    );

    await waitFor(() =>
      expect(posthog.capture).toHaveBeenCalledWith(
        "workflow.instance_created",
        { instance_id: "inst-new", template_id: "client-delivery" },
      ),
    );

    await waitFor(() =>
      expect(pushSpy).toHaveBeenCalledWith("/workflows/inst-new"),
    );

    await waitFor(() =>
      expect(screen.queryByTestId("create-instance-modal")).not.toBeInTheDocument(),
    );
  });

  it("surfaces server-action errors inline and keeps the modal open", async () => {
    const user = userEvent.setup();
    mockCreateInstanceAction.mockRejectedValue(
      new Error("createInstance: unknown template_id"),
    );

    renderWithToast(
      <SidebarWorkflowTree
        templates={[TEMPLATE_A]}
        instancesByTemplate={{ "client-delivery": [] }}
      />,
    );

    await user.click(screen.getByTestId("workflow-new-instance-client-delivery"));
    await user.type(
      screen.getByRole("textbox", { name: /instance name/i }),
      "Acme",
    );
    await user.click(screen.getByRole("button", { name: /^create\s*→?$/i }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(/unknown template_id/i),
    );
    expect(screen.getByTestId("create-instance-modal")).toBeInTheDocument();
    expect(pushSpy).not.toHaveBeenCalled();
  });
});
