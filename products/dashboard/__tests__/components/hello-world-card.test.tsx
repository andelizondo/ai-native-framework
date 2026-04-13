/**
 * Component tests for components/hello-world-card.tsx
 * Spec anchor: dashboard.shell_viewed — home page card renders the shell state.
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { HelloWorldCard } from "@/components/hello-world-card";

describe("HelloWorldCard", () => {
  it("renders the heading", () => {
    render(<HelloWorldCard />);
    expect(
      screen.getByRole("heading", { name: /hello, world/i }),
    ).toBeInTheDocument();
  });

  it("renders the card description", () => {
    render(<HelloWorldCard />);
    expect(screen.getByText(/AI-Native Dashboard/)).toBeInTheDocument();
  });

  it("renders links to all three product phases", () => {
    render(<HelloWorldCard />);
    const ideationLink = screen.getByRole("link", { name: /ideation/i });
    const designLink = screen.getByRole("link", { name: /design/i });
    const implementationLink = screen.getByRole("link", {
      name: /implementation/i,
    });

    expect(ideationLink).toHaveAttribute("href", "/ideation");
    expect(designLink).toHaveAttribute("href", "/design");
    expect(implementationLink).toHaveAttribute("href", "/implementation");
  });

  it("renders the spec reference in the footer", () => {
    render(<HelloWorldCard />);
    expect(screen.getByText(/dashboard-product\.yaml/)).toBeInTheDocument();
  });

  it("renders the shell_viewed event reference in the footer", () => {
    render(<HelloWorldCard />);
    expect(screen.getByText(/dashboard\.shell_viewed/)).toBeInTheDocument();
  });
});
