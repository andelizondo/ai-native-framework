/**
 * Component tests for components/sidebar.tsx
 * Spec anchor: dashboard.phase_navigated — sidebar navigation links trigger phase events.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/sidebar";

describe("Sidebar", () => {
  it("renders the brand name", () => {
    render(<Sidebar />);
    expect(screen.getByText("AI-Native")).toBeInTheDocument();
  });

  it("renders the brand logo link pointing to home", () => {
    render(<Sidebar />);
    const logoLink = screen.getByRole("link", { name: /ai-native/i });
    expect(logoLink).toHaveAttribute("href", "/");
  });

  it("renders navigation links for all three phases", () => {
    render(<Sidebar />);
    expect(
      screen.getByRole("link", { name: /ideation/i }),
    ).toHaveAttribute("href", "/ideation");
    expect(screen.getByRole("link", { name: /design/i })).toHaveAttribute(
      "href",
      "/design",
    );
    expect(
      screen.getByRole("link", { name: /implementation/i }),
    ).toHaveAttribute("href", "/implementation");
  });

  it("renders a navigation landmark", () => {
    render(<Sidebar />);
    expect(screen.getByRole("navigation")).toBeInTheDocument();
  });

  it("applies active styles to the current pathname link", () => {
    vi.mocked(usePathname).mockReturnValue("/ideation");
    render(<Sidebar />);
    const ideationLink = screen.getByRole("link", { name: /ideation/i });
    // Active link gets a background utility class; check it differs from inactive links
    expect(ideationLink.className).toContain("bg-amber-50");
  });

  it("does not apply active styles to inactive links when on /ideation", () => {
    vi.mocked(usePathname).mockReturnValue("/ideation");
    render(<Sidebar />);
    const designLink = screen.getByRole("link", { name: /design/i });
    expect(designLink.className).not.toContain("bg-blue-50");
  });

  it("emits analytics on phase link click", async () => {
    const user = userEvent.setup();
    // Import after mock setup so posthog is the mocked version
    const posthog = (await import("posthog-js")).default;

    render(<Sidebar />);
    await user.click(screen.getByRole("link", { name: /ideation/i }));

    expect(posthog.capture).toHaveBeenCalledWith("dashboard.phase_navigated", {
      phase: "ideation",
    });
  });
});
