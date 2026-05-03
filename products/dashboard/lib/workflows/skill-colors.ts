import type { WorkflowSkill } from "./types";

/**
 * Skill row colour palette. The schema doesn't store a per-skill colour by
 * default, so the matrix derives one by indexing into this fixed palette.
 */
export const SKILL_COLORS = [
  "#6366f1",
  "#10b981",
  "#f59e0b",
  "#06b6d4",
  "#8b5cf6",
  "#f97316",
  "#ec4899",
  "#64748b",
] as const;

/**
 * Resolve a stable display colour for a skill row. Skills missing from the
 * list fall back to the first palette entry so the swatch renders even when
 * an instance is opened with stale data.
 */
export function getSkillColor(skillId: string, skills: WorkflowSkill[]): string {
  const idx = skills.findIndex((skill) => skill.id === skillId);
  if (idx < 0) {
    return SKILL_COLORS[0];
  }
  return skills[idx]?.color || SKILL_COLORS[idx % SKILL_COLORS.length];
}
