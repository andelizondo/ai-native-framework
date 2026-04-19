// @vitest-environment node

import { describe, expect, it } from "vitest";

import { ROLE_COLORS, getRoleColor } from "@/lib/workflows/role-colors";
import type { WorkflowRole } from "@/lib/workflows/types";

const ROLES: WorkflowRole[] = [
  { id: "sales", label: "Sales" },
  { id: "product", label: "Product" },
  { id: "finance", label: "Finance" },
];

describe("getRoleColor", () => {
  it("returns the palette colour at the role's index", () => {
    expect(getRoleColor("sales", ROLES)).toBe(ROLE_COLORS[0]);
    expect(getRoleColor("product", ROLES)).toBe(ROLE_COLORS[1]);
    expect(getRoleColor("finance", ROLES)).toBe(ROLE_COLORS[2]);
  });

  it("wraps around the palette when there are more roles than colours", () => {
    const wrapping: WorkflowRole[] = Array.from(
      { length: ROLE_COLORS.length + 2 },
      (_unused, idx) => ({ id: `role-${idx}`, label: `Role ${idx}` }),
    );

    expect(getRoleColor(`role-${ROLE_COLORS.length}`, wrapping)).toBe(
      ROLE_COLORS[0],
    );
    expect(getRoleColor(`role-${ROLE_COLORS.length + 1}`, wrapping)).toBe(
      ROLE_COLORS[1],
    );
  });

  it("falls back to the first palette colour when the role is missing", () => {
    expect(getRoleColor("ghost", ROLES)).toBe(ROLE_COLORS[0]);
  });
});
