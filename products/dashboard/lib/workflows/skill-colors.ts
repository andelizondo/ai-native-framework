import type { FrameworkItem } from "./types";

/**
 * Identity-color palette for Skills and Playbooks. The user picks one of
 * these (or a custom hex) on the framework item editor; until a value is
 * chosen we fall back to a stable id-derived hash so existing items still
 * render with a recognisable color. Twenty curated swatches arranged 3×7 in
 * the popover (the trailing slot is the rainbow → native picker).
 */
export const SKILL_COLORS = [
  // Row 1 — cool blues / greens
  "#6366f1",
  "#3b82f6",
  "#0ea5e9",
  "#06b6d4",
  "#14b8a6",
  "#10b981",
  "#22c55e",
  // Row 2 — warm yellows / reds
  "#84cc16",
  "#eab308",
  "#f59e0b",
  "#f97316",
  "#ef4444",
  "#f43f5e",
  "#ec4899",
  // Row 3 — purples + neutrals
  "#d946ef",
  "#a855f7",
  "#8b5cf6",
  "#64748b",
  "#737373",
  "#78716c",
] as const;

export type SkillColor = (typeof SKILL_COLORS)[number] | string;

function hashIndex(id: string, len: number): number {
  // djb2 — fast, deterministic, and good enough to spread a small set of ids
  // across a fixed palette. Same hash as the previous inline version in the
  // allowed-items picker so existing items keep the same fallback color.
  let h = 5381;
  for (let i = 0; i < id.length; i++) {
    h = ((h << 5) + h + id.charCodeAt(i)) | 0;
  }
  return Math.abs(h) % len;
}

/** Stable id-only fallback used when a framework item has no chosen color. */
export function fallbackColorForId(id: string): string {
  return SKILL_COLORS[hashIndex(id, SKILL_COLORS.length)]!;
}

/**
 * Resolve the display color for any framework item (skill or playbook).
 * Honors a user-chosen `color` if set; otherwise derives a stable color
 * from the id so the avatar still renders consistently across views.
 */
export function resolveItemColor(item: {
  id: string;
  color?: string | null;
}): string {
  return item.color?.trim() || fallbackColorForId(item.id);
}

/**
 * Resolve a matrix skill row's color from the framework `skill` items list.
 * Returns the chosen color if the framework item is in scope, the id-hash
 * fallback otherwise (covers stale snapshots where the skill was deleted
 * from the library after the workflow was created).
 */
export function resolveSkillColor(
  skillId: string,
  frameworkSkills: readonly Pick<FrameworkItem, "id" | "color">[],
): string {
  const match = frameworkSkills.find((item) => item.id === skillId);
  return match ? resolveItemColor(match) : fallbackColorForId(skillId);
}
