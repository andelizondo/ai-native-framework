// @vitest-environment node

import { describe, expect, it } from "vitest";

import { SKILL_COLORS, getSkillColor } from "@/lib/workflows/skill-colors";
import type { WorkflowSkill } from "@/lib/workflows/types";

const SKILLS: WorkflowSkill[] = [
  { id: "sales-ops", label: "Sales Ops" },
  { id: "pm", label: "PM" },
  { id: "finance-ops", label: "Finance Ops" },
];

describe("getSkillColor", () => {
  it("returns the palette colour at the skill's index", () => {
    expect(getSkillColor("sales-ops", SKILLS)).toBe(SKILL_COLORS[0]);
    expect(getSkillColor("pm", SKILLS)).toBe(SKILL_COLORS[1]);
    expect(getSkillColor("finance-ops", SKILLS)).toBe(SKILL_COLORS[2]);
  });

  it("wraps around the palette when there are more skills than colours", () => {
    const wrapping: WorkflowSkill[] = Array.from(
      { length: SKILL_COLORS.length + 2 },
      (_unused, idx) => ({ id: `skill-${idx}`, label: `Skill ${idx}` }),
    );

    expect(getSkillColor(`skill-${SKILL_COLORS.length}`, wrapping)).toBe(
      SKILL_COLORS[0],
    );
    expect(getSkillColor(`skill-${SKILL_COLORS.length + 1}`, wrapping)).toBe(
      SKILL_COLORS[1],
    );
  });

  it("falls back to the first palette colour when the skill is missing", () => {
    expect(getSkillColor("ghost", SKILLS)).toBe(SKILL_COLORS[0]);
  });
});
