// @vitest-environment node

import { describe, expect, it } from "vitest";

import {
  SKILL_COLORS,
  fallbackColorForId,
  resolveItemColor,
  resolveSkillColor,
} from "@/lib/workflows/skill-colors";
import type { FrameworkItem } from "@/lib/workflows/types";

const SKILL_ITEMS: Pick<FrameworkItem, "id" | "color">[] = [
  { id: "sales-ops", color: "#6366f1" },
  { id: "pm", color: undefined },
  { id: "finance-ops", color: "#10b981" },
];

describe("resolveItemColor", () => {
  it("returns the user-chosen color when set", () => {
    expect(resolveItemColor({ id: "x", color: "#abcdef" })).toBe("#abcdef");
  });

  it("falls back to the id-hash palette when no color is set", () => {
    expect(resolveItemColor({ id: "pm" })).toBe(fallbackColorForId("pm"));
  });
});

describe("resolveSkillColor", () => {
  it("uses the matching framework item's chosen color", () => {
    expect(resolveSkillColor("sales-ops", SKILL_ITEMS)).toBe("#6366f1");
  });

  it("falls back to the id-hash palette when the item has no color", () => {
    expect(resolveSkillColor("pm", SKILL_ITEMS)).toBe(fallbackColorForId("pm"));
  });

  it("falls back to the id-hash palette when the skill is missing", () => {
    expect(resolveSkillColor("ghost", SKILL_ITEMS)).toBe(
      fallbackColorForId("ghost"),
    );
  });
});

describe("SKILL_COLORS", () => {
  it("exposes the 20-swatch palette", () => {
    expect(SKILL_COLORS).toHaveLength(20);
  });
});
