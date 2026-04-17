/**
 * Component tests for components/top-bar.tsx
 * Spec anchor: dashboard shell — TopBar renders status and user area.
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TopBar } from "@/components/top-bar";

describe("TopBar", () => {
  it("renders the Dashboard page title", () => {
    render(
      <TopBar
        user={{ id: "user-123", email: "andres@example.com", provider: "magic_link" }}
      />,
    );
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
  });

  it("renders the Planning status badge", () => {
    render(
      <TopBar
        user={{ id: "user-123", email: "andres@example.com", provider: "magic_link" }}
      />,
    );
    expect(screen.getByText("Planning")).toBeInTheDocument();
  });

  it("renders a header landmark", () => {
    render(
      <TopBar
        user={{ id: "user-123", email: "andres@example.com", provider: "magic_link" }}
      />,
    );
    expect(screen.getByRole("banner")).toBeInTheDocument();
  });

  it("renders the user avatar placeholder", () => {
    render(
      <TopBar
        user={{ id: "user-123", email: "andres@example.com", provider: "magic_link" }}
      />,
    );
    // Avatar is rendered as a div with the letter 'A'
    expect(screen.getByText("A")).toBeInTheDocument();
  });

  it("trims whitespace from the displayed email", () => {
    render(
      <TopBar
        user={{
          id: "user-123",
          email: "  andres@example.com  ",
          provider: "magic_link",
        }}
      />,
    );

    expect(screen.getByText("andres@example.com")).toBeInTheDocument();
  });
});
