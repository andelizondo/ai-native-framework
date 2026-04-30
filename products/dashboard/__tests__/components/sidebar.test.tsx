/**
 * Component tests for components/sidebar.tsx
 * Spec anchor: AEL-46 — Shell rewrite (Sidebar + TopBar + auth wiring + stub Overview).
 *
 * Covers:
 *   - Sidebar renders the canonical nav (Overview, Skills, Playbooks,
 *     Event Feed, Settings) with correct hrefs.
 *   - Active route is reflected via aria-current=page.
 *   - The collapse toggle flips `<html data-sidebar>` so CSS can hide
 *     labels without React having to re-render the tree.
 *   - User menu opens, exposes the theme toggle and a sign-out item, and
 *     calls the shared sign-out flow when clicked.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { usePathname } from "next/navigation";

import { renderWithToast } from "@/tests/test-utils";

const { mockHandleSignOut, mockToggleTheme } = vi.hoisted(() => ({
  mockHandleSignOut: vi.fn(),
  mockToggleTheme: vi.fn(),
}));

vi.mock("@/lib/auth/use-sign-out", () => ({
  useSignOut: vi.fn(() => ({
    handleSignOut: mockHandleSignOut,
    loading: false,
    error: null,
  })),
}));

vi.mock("@/lib/theme", () => ({
  useTheme: vi.fn(() => ({
    theme: "dark",
    setTheme: vi.fn(),
    toggleTheme: mockToggleTheme,
  })),
}));

import { Sidebar } from "@/components/sidebar";

const TEST_USER = {
  id: "user-123",
  email: "andres@example.com",
  provider: "magic_link" as const,
};

describe("Sidebar", () => {
  beforeEach(() => {
    mockHandleSignOut.mockReset();
    mockToggleTheme.mockReset();
    vi.mocked(usePathname).mockReturnValue("/");
    // The inline script in app/layout.tsx normally sets this before paint;
    // in jsdom we set it explicitly so the store has a starting truth.
    document.documentElement.setAttribute("data-sidebar", "expanded");
    window.localStorage.clear();
  });

  it("renders the brand name and version", () => {
    renderWithToast(<Sidebar user={TEST_USER} />);
    expect(screen.getByText("AI-Native")).toBeInTheDocument();
    expect(screen.getByText("v0.1")).toBeInTheDocument();
  });

  it("renders the canonical navigation links", () => {
    renderWithToast(<Sidebar user={TEST_USER} />);
    expect(screen.getByRole("link", { name: /overview/i })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: /skills/i })).toHaveAttribute(
      "href",
      "/framework/skills",
    );
    expect(screen.getByRole("link", { name: /playbooks/i })).toHaveAttribute(
      "href",
      "/framework/playbooks",
    );
    expect(screen.getByRole("link", { name: /event feed/i })).toHaveAttribute(
      "href",
      "/events",
    );
    expect(screen.getByRole("link", { name: /settings/i })).toHaveAttribute(
      "href",
      "/settings",
    );
  });

  it("marks the active route with aria-current=page", () => {
    vi.mocked(usePathname).mockReturnValue("/framework/skills");
    renderWithToast(<Sidebar user={TEST_USER} />);
    expect(screen.getByRole("link", { name: /skills/i })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: /overview/i })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("renders the workflows empty-state placeholder", () => {
    renderWithToast(<Sidebar user={TEST_USER} />);
    expect(screen.getByTestId("sidebar-workflows-empty")).toBeInTheDocument();
  });

  it("renders the user button with email-derived initials", () => {
    renderWithToast(<Sidebar user={TEST_USER} />);
    const trigger = screen.getByRole("button", { name: /open user menu/i });
    expect(trigger).toBeInTheDocument();
    expect(trigger).toHaveTextContent("A"); // initial of "andres"
    expect(screen.getByText("andres@example.com")).toBeInTheDocument();
  });

  it("collapse toggle flips <html data-sidebar>", async () => {
    const user = userEvent.setup();
    renderWithToast(<Sidebar user={TEST_USER} />);

    expect(document.documentElement.getAttribute("data-sidebar")).toBe("expanded");

    await user.click(screen.getByRole("button", { name: /collapse sidebar/i }));

    expect(document.documentElement.getAttribute("data-sidebar")).toBe("collapsed");
  });

  it("opens the user menu and exposes theme + sign-out items", async () => {
    const user = userEvent.setup();
    renderWithToast(<Sidebar user={TEST_USER} />);

    await user.click(screen.getByRole("button", { name: /open user menu/i }));

    const menu = await screen.findByRole("menu", { name: /user menu/i });
    expect(menu).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /light mode/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /sign out/i })).toBeInTheDocument();
  });

  it("invokes the shared sign-out flow from the user menu", async () => {
    const user = userEvent.setup();
    renderWithToast(<Sidebar user={TEST_USER} />);

    await user.click(screen.getByRole("button", { name: /open user menu/i }));
    await user.click(screen.getByRole("menuitem", { name: /sign out/i }));

    await waitFor(() => expect(mockHandleSignOut).toHaveBeenCalledOnce());
  });

  it("toggles the theme via the user menu and closes the menu", async () => {
    const user = userEvent.setup();
    renderWithToast(<Sidebar user={TEST_USER} />);

    await user.click(screen.getByRole("button", { name: /open user menu/i }));
    // `userEvent` simulates a realistic open click on the trigger. The
    // menuitem click below uses `fireEvent` (synchronous) so we can assert
    // `mockToggleTheme` and the menu-close transition without racing the
    // outside-click handler that `userEvent`'s async pointer events would
    // schedule.
    fireEvent.click(screen.getByRole("menuitem", { name: /light mode/i }));

    expect(mockToggleTheme).toHaveBeenCalledOnce();
    await waitFor(() =>
      expect(screen.queryByRole("menu", { name: /user menu/i })).not.toBeInTheDocument(),
    );
  });
});
