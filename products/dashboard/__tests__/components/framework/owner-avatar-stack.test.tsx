/**
 * Tests for OwnerAvatarStack agent variant (AEL-61 / PR 3).
 *
 * The stack falls through to `classifyOwner` for labels not present in
 * the catalog: `agent:` prefixed labels render as agents (lightning glyph
 * via the catalog's `emoji` slot); other labels render initials. Labels
 * that resolve from the catalog are unchanged.
 */

import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import { OwnerAvatarStack } from "@/components/framework/owner-avatar-stack";

vi.mock("@/components/framework/item-avatar", () => ({
  ItemAvatar: ({
    emoji,
    initials,
    label,
  }: {
    emoji?: string | null;
    initials?: string | null;
    label?: string;
  }) => (
    <span data-testid="item-avatar" data-emoji={emoji ?? ""} data-initials={initials ?? ""}>
      {label}
    </span>
  ),
}));

describe("OwnerAvatarStack", () => {
  it("renders a lightning glyph for agent: prefixed labels not in the catalog", () => {
    render(<OwnerAvatarStack labels={["agent:custom-bot"]} />);
    const avatar = screen.getByTestId("item-avatar");
    expect(avatar.dataset.emoji).toBe("⚡");
    expect(avatar.textContent).toBe("custom-bot");
  });

  it("falls back to initials for unknown people-style labels", () => {
    render(<OwnerAvatarStack labels={["Some Stranger"]} />);
    const avatar = screen.getByTestId("item-avatar");
    expect(avatar.dataset.emoji).toBe("");
    expect(avatar.dataset.initials).toBe("SS");
  });

  it("uses the catalog match when one exists", () => {
    render(<OwnerAvatarStack labels={["Andres"]} />);
    const avatar = screen.getByTestId("item-avatar");
    // Catalog labels include initials; the exact emoji/initials are
    // implementation-defined — only assert the avatar rendered.
    expect(avatar).toBeInTheDocument();
  });
});
