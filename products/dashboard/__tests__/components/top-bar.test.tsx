/**
 * Component tests for components/top-bar.tsx
 * Spec anchor: AEL-46 — Shell rewrite (Sidebar + TopBar + auth wiring + stub Overview).
 *
 * Covers:
 *   - The breadcrumb is derived from the active route (Overview / Skills /
 *     Playbooks / Event Feed / Settings).
 *   - The header landmark and the placeholder "My Tasks" pill render.
 *   - Unknown routes still produce a sensible humanised fallback so a new
 *     route added before the table is updated does not blank the chrome.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import React from "react";

import { DashboardTopBarProvider, useDashboardTopBar } from "@/components/dashboard-topbar-context";
import { TopBar } from "@/components/top-bar";

function renderWithTopBarProvider(ui: React.ReactNode) {
  return render(<DashboardTopBarProvider>{ui}</DashboardTopBarProvider>);
}

describe("TopBar", () => {
  it("renders the Overview breadcrumb on the home route", () => {
    vi.mocked(usePathname).mockReturnValue("/");
    renderWithTopBarProvider(<TopBar />);
    const crumb = screen.getByText("Overview");
    expect(crumb).toBeInTheDocument();
    expect(crumb).toHaveAttribute("aria-current", "page");
  });

  it("renders 'Skills' on /framework/skills", () => {
    vi.mocked(usePathname).mockReturnValue("/framework/skills");
    renderWithTopBarProvider(<TopBar />);
    expect(screen.getByText("Skills")).toBeInTheDocument();
  });

  it("renders 'Playbooks' on /framework/playbooks", () => {
    vi.mocked(usePathname).mockReturnValue("/framework/playbooks");
    renderWithTopBarProvider(<TopBar />);
    expect(screen.getByText("Playbooks")).toBeInTheDocument();
  });

  it("renders 'Event Feed' on /events", () => {
    vi.mocked(usePathname).mockReturnValue("/events");
    renderWithTopBarProvider(<TopBar />);
    expect(screen.getByText("Event Feed")).toBeInTheDocument();
  });

  it("renders 'Settings' on /settings", () => {
    vi.mocked(usePathname).mockReturnValue("/settings");
    renderWithTopBarProvider(<TopBar />);
    expect(screen.getByText("Settings")).toBeInTheDocument();
  });

  it("falls back to a humanised crumb for unknown routes", () => {
    vi.mocked(usePathname).mockReturnValue("/some-future-route");
    renderWithTopBarProvider(<TopBar />);
    expect(screen.getByText("Some Future Route")).toBeInTheDocument();
  });

  it("renders a header landmark", () => {
    vi.mocked(usePathname).mockReturnValue("/");
    renderWithTopBarProvider(<TopBar />);
    expect(screen.getByTestId("topbar-header")).toBeInTheDocument();
  });

  it("renders the My Tasks pill and it toggles expanded state when clicked", async () => {
    vi.mocked(usePathname).mockReturnValue("/");
    const user = userEvent.setup();
    renderWithTopBarProvider(<TopBar />);
    const pill = screen.getByTestId("topbar-my-tasks-btn");
    expect(pill).toBeInTheDocument();
    expect(pill).toHaveAttribute("aria-expanded", "false");

    await user.click(pill);
    expect(pill).toHaveAttribute("aria-expanded", "true");
  });

  it("renders the workflow edit pill and toggles the edit query param", async () => {
    vi.mocked(usePathname).mockReturnValue("/workflows/123");
    vi.mocked(useSearchParams).mockReturnValue(new URLSearchParams());
    const replace = vi.fn();
    vi.mocked(useRouter).mockReturnValue({
      push: vi.fn(),
      replace,
      back: vi.fn(),
      forward: vi.fn(),
      refresh: vi.fn(),
      prefetch: vi.fn(),
    });

    renderWithTopBarProvider(<TopBar />);

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Edit" }));

    expect(replace).toHaveBeenCalledWith("/workflows/123?edit=1", { scroll: false });
  });

  it("renders the template-editor breadcrumb input and save pill when configured", () => {
    vi.mocked(usePathname).mockReturnValue("/workflows/templates/client-delivery/edit");

    function Harness() {
      const { setConfig } = useDashboardTopBar();
      React.useEffect(() => {
        setConfig({
          mode: "template-editor",
          label: "Client Project Delivery",
          onLabelChange: vi.fn(),
          onSave: vi.fn(),
          saveDisabled: false,
        });
        return () => setConfig(null);
      }, [setConfig]);

      return <TopBar />;
    }

    render(
      <DashboardTopBarProvider>
        <Harness />
      </DashboardTopBarProvider>,
    );

    expect(
      screen.getByRole("textbox", { name: "Workflow template name" }),
    ).toHaveValue("Client Project Delivery");
    expect(screen.getByRole("button", { name: /save workflow/i })).toBeInTheDocument();
    expect(screen.queryByTestId("topbar-my-tasks-btn")).not.toBeInTheDocument();
  });
});
