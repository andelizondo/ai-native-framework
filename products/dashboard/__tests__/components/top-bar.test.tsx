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
import { usePathname } from "next/navigation";

import { TopBar } from "@/components/top-bar";

describe("TopBar", () => {
  it("renders the Overview breadcrumb on the home route", () => {
    vi.mocked(usePathname).mockReturnValue("/");
    render(<TopBar />);
    const crumb = screen.getByText("Overview");
    expect(crumb).toBeInTheDocument();
    expect(crumb).toHaveAttribute("aria-current", "page");
  });

  it("renders 'Skills' on /framework/skills", () => {
    vi.mocked(usePathname).mockReturnValue("/framework/skills");
    render(<TopBar />);
    expect(screen.getByText("Skills")).toBeInTheDocument();
  });

  it("renders 'Playbooks' on /framework/playbooks", () => {
    vi.mocked(usePathname).mockReturnValue("/framework/playbooks");
    render(<TopBar />);
    expect(screen.getByText("Playbooks")).toBeInTheDocument();
  });

  it("renders 'Event Feed' on /events", () => {
    vi.mocked(usePathname).mockReturnValue("/events");
    render(<TopBar />);
    expect(screen.getByText("Event Feed")).toBeInTheDocument();
  });

  it("renders 'Settings' on /settings", () => {
    vi.mocked(usePathname).mockReturnValue("/settings");
    render(<TopBar />);
    expect(screen.getByText("Settings")).toBeInTheDocument();
  });

  it("falls back to a humanised crumb for unknown routes", () => {
    vi.mocked(usePathname).mockReturnValue("/some-future-route");
    render(<TopBar />);
    expect(screen.getByText("Some Future Route")).toBeInTheDocument();
  });

  it("renders a header landmark", () => {
    vi.mocked(usePathname).mockReturnValue("/");
    render(<TopBar />);
    expect(screen.getByRole("banner")).toBeInTheDocument();
  });

  it("renders the My Tasks pill as a disabled placeholder", () => {
    vi.mocked(usePathname).mockReturnValue("/");
    render(<TopBar />);
    const pill = screen.getByRole("button", { name: /my tasks/i });
    expect(pill).toBeDisabled();
  });
});
