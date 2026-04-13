// @vitest-environment node
/**
 * Integration tests for app/api/events/route.ts (POST /api/events)
 * Spec anchor: dashboard-product.yaml → events.catalog
 *
 * Tests call the route handler directly with a Web API Request object.
 * No running server needed; @sentry/nextjs is mocked globally via tests/setup.tsx.
 */

import { describe, it, expect } from "vitest";
import { POST } from "@/app/api/events/route";
import type { NextRequest } from "next/server";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeReq(
  body: unknown,
  headers: Record<string, string> = {},
): NextRequest {
  return new Request("http://localhost/api/events", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
}

function validShellViewed(overrides: Record<string, unknown> = {}) {
  return {
    event_name: "dashboard.shell_viewed",
    occurred_at: new Date().toISOString(),
    emitted_by: "client",
    schema_version: "1.0.0",
    payload: { route: "/" },
    ...overrides,
  };
}

function validPhaseNavigated(phase = "ideation", overrides: Record<string, unknown> = {}) {
  return {
    event_name: "dashboard.phase_navigated",
    occurred_at: new Date().toISOString(),
    emitted_by: "client",
    schema_version: "1.0.0",
    payload: { phase },
    ...overrides,
  };
}

// ─── Happy-path tests ─────────────────────────────────────────────────────────

describe("POST /api/events — happy path", () => {
  it("accepts a valid dashboard.shell_viewed event and returns 202", async () => {
    const res = await POST(makeReq(validShellViewed()));
    expect(res.status).toBe(202);
    const json = await res.json();
    expect(json.ok).toBe(true);
  });

  it("accepts dashboard.phase_navigated for ideation and returns 202", async () => {
    const res = await POST(makeReq(validPhaseNavigated("ideation")));
    expect(res.status).toBe(202);
  });

  it("accepts dashboard.phase_navigated for design and returns 202", async () => {
    const res = await POST(makeReq(validPhaseNavigated("design")));
    expect(res.status).toBe(202);
  });

  it("accepts dashboard.phase_navigated for implementation and returns 202", async () => {
    const res = await POST(makeReq(validPhaseNavigated("implementation")));
    expect(res.status).toBe(202);
  });

  it("echoes a valid correlation_id in the response", async () => {
    const correlationId = "550e8400-e29b-41d4-a716-446655440000";
    const res = await POST(makeReq(validShellViewed({ correlation_id: correlationId })));
    expect(res.status).toBe(202);
    const json = await res.json();
    expect(json.correlation_id).toBe(correlationId);
  });

  it("accepts a valid correlation_id in the x-correlation-id header", async () => {
    const correlationId = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";
    const res = await POST(
      makeReq(validShellViewed(), { "x-correlation-id": correlationId }),
    );
    expect(res.status).toBe(202);
  });
});

// ─── Validation error tests ───────────────────────────────────────────────────

describe("POST /api/events — validation errors", () => {
  it("returns 400 for invalid JSON body", async () => {
    const req = new Request("http://localhost/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json{{{",
    }) as unknown as NextRequest;
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 when event_name is missing", async () => {
    const body = validShellViewed();
    delete (body as Record<string, unknown>).event_name;
    const res = await POST(makeReq(body));
    expect(res.status).toBe(400);
  });

  it("returns 400 when occurred_at is missing", async () => {
    const body = validShellViewed();
    delete (body as Record<string, unknown>).occurred_at;
    const res = await POST(makeReq(body));
    expect(res.status).toBe(400);
  });

  it("returns 400 when payload is missing", async () => {
    const body = validShellViewed();
    delete (body as Record<string, unknown>).payload;
    const res = await POST(makeReq(body));
    expect(res.status).toBe(400);
  });

  it("returns 400 when payload is an array instead of object", async () => {
    const res = await POST(makeReq({ ...validShellViewed(), payload: [] }));
    expect(res.status).toBe(400);
  });

  it("returns 422 for an unknown event name", async () => {
    const res = await POST(makeReq(validShellViewed({ event_name: "unknown.event" })));
    expect(res.status).toBe(422);
  });

  it("returns 400 for dashboard.shell_viewed with missing route in payload", async () => {
    const res = await POST(makeReq(validShellViewed({ payload: {} })));
    expect(res.status).toBe(400);
  });

  it("returns 400 for dashboard.phase_navigated with invalid phase value", async () => {
    const res = await POST(makeReq(validPhaseNavigated("invalid-phase")));
    expect(res.status).toBe(400);
  });

  it("ignores a malformed correlation_id header (does not crash)", async () => {
    const res = await POST(
      makeReq(validShellViewed(), { "x-correlation-id": "not-a-uuid" }),
    );
    // Malformed ID is silently discarded; request should still succeed
    expect(res.status).toBe(202);
  });
});
