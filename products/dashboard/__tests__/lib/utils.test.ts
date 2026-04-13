/**
 * Unit tests for lib/utils.ts
 * Spec anchor: utility functions used across the dashboard shell (no spec event entry required).
 */

import { describe, it, expect } from "vitest";
import { cn } from "@/lib/utils";

describe("cn (class merge utility)", () => {
  it("returns a single class unchanged", () => {
    expect(cn("foo")).toBe("foo");
  });

  it("joins multiple class strings", () => {
    expect(cn("foo", "bar")).toBe("foo bar");
  });

  it("filters out falsy values", () => {
    expect(cn("foo", false && "bar", undefined, null, "baz")).toBe("foo baz");
  });

  it("handles conditional objects", () => {
    expect(cn({ foo: true, bar: false, baz: true })).toBe("foo baz");
  });

  it("merges conflicting Tailwind classes — last wins", () => {
    // tailwind-merge resolves conflicts: p-2 then p-4 → p-4
    expect(cn("p-2", "p-4")).toBe("p-4");
  });

  it("merges conflicting Tailwind modifiers correctly", () => {
    expect(cn("text-sm", "text-lg")).toBe("text-lg");
  });

  it("handles array inputs", () => {
    expect(cn(["foo", "bar"])).toBe("foo bar");
  });

  it("returns empty string for no arguments", () => {
    expect(cn()).toBe("");
  });
});
