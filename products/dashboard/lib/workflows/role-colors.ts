import type { WorkflowRole } from "./types";

/**
 * Role colour palette.
 *
 * Source: `ROLE_COLORS` in
 * `/tmp/design-canvas/ai-native-dashboard/project/pc-components.jsx`
 * (line 4). The Process Canvas prototype derives a role's swatch by
 * indexing into this fixed palette; the database schema doesn't store
 * a per-role colour today, so we mirror the same index-based mapping
 * here. Keeping the array length stable across the palette also lets
 * tests hard-code the expected colour for a given role index.
 */
export const ROLE_COLORS = [
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
 * Resolve a stable display colour for a role.
 *
 * Behaviour matches the prototype's `ROLE_COLORS[i % ROLE_COLORS.length]`
 * (`pc-components.jsx` line 491). Roles missing from the list fall back
 * to the first palette entry so callers always receive a renderable
 * colour, which keeps the role pip / task-card accent visible even if
 * an instance is opened with stale role data.
 */
export function getRoleColor(roleId: string, roles: WorkflowRole[]): string {
  const idx = roles.findIndex((role) => role.id === roleId);
  if (idx < 0) {
    return ROLE_COLORS[0];
  }
  return roles[idx]?.color || ROLE_COLORS[idx % ROLE_COLORS.length];
}
