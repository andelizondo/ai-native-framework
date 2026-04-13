/**
 * Unit tests for lib/correlation.ts
 * Spec anchor: dashboard-shell correlation ID contract (spec/examples/dashboard-product.yaml).
 */

import { describe, it, expect } from "vitest";
import {
  normalizeCorrelationId,
  normalizeObservabilityFeature,
} from "@/lib/correlation";

// ─── normalizeCorrelationId ───────────────────────────────────────────────────

describe("normalizeCorrelationId", () => {
  it("accepts a valid UUID v4", () => {
    const id = "550e8400-e29b-41d4-a716-446655440000";
    expect(normalizeCorrelationId(id)).toBe(id);
  });

  it("accepts UUID v1", () => {
    const id = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";
    expect(normalizeCorrelationId(id)).toBe(id);
  });

  it("accepts UUID v3", () => {
    const id = "6ba7b810-9dad-31d1-80b4-00c04fd430c8";
    expect(normalizeCorrelationId(id)).toBe(id);
  });

  it("returns null for non-UUID string", () => {
    expect(normalizeCorrelationId("not-a-uuid")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(normalizeCorrelationId("")).toBeNull();
  });

  it("returns null for non-string number", () => {
    expect(normalizeCorrelationId(12345)).toBeNull();
  });

  it("returns null for null input", () => {
    expect(normalizeCorrelationId(null)).toBeNull();
  });

  it("returns null for undefined input", () => {
    expect(normalizeCorrelationId(undefined)).toBeNull();
  });

  it("returns null for object input", () => {
    expect(normalizeCorrelationId({})).toBeNull();
  });

  it("returns null for a UUID v6+ (version digit > 5)", () => {
    // v6 has version digit 6 — rejected by the v1-v5 pattern
    const v6 = "1ed6-d27c-6b4e-6000-8000-000000000000";
    expect(normalizeCorrelationId(v6)).toBeNull();
  });
});

// ─── normalizeObservabilityFeature ───────────────────────────────────────────

describe("normalizeObservabilityFeature", () => {
  it("passes through safe alphanumeric strings unchanged", () => {
    expect(normalizeObservabilityFeature("api.events")).toBe("api.events");
  });

  it("passes through strings with allowed special chars (. _ -)", () => {
    expect(normalizeObservabilityFeature("dashboard.shell-v1_beta")).toBe(
      "dashboard.shell-v1_beta",
    );
  });

  it("replaces disallowed characters with underscores", () => {
    expect(normalizeObservabilityFeature("feat/my feature!")).toBe(
      "feat_my_feature_",
    );
  });

  it("trims leading and trailing whitespace before normalizing", () => {
    expect(normalizeObservabilityFeature("  events  ")).toBe("events");
  });

  it("returns 'unknown' for empty string after trimming", () => {
    expect(normalizeObservabilityFeature("")).toBe("unknown");
    expect(normalizeObservabilityFeature("   ")).toBe("unknown");
  });

  it("truncates strings longer than 64 characters", () => {
    const longFeature = "a".repeat(100);
    const result = normalizeObservabilityFeature(longFeature);
    expect(result.length).toBeLessThanOrEqual(64);
  });
});
