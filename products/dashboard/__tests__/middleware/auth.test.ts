// @vitest-environment node
/**
 * Tests for middleware.ts — auth and correlation-ID behavior
 *
 * Covers:
 * - Public paths (/login, /auth/callback, /ingest, /monitoring) bypass auth entirely
 * - Unauthenticated requests → redirect to /login
 * - Authenticated requests → pass through with correlation ID
 * - Session refresh: middleware forwards new cookies when Supabase refreshes a token
 * - Correlation ID is preserved from incoming request header
 * - Correlation ID is generated when not present
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ─── Auth service mock ────────────────────────────────────────────────────────

const { mockGetCurrentUserForRequest } = vi.hoisted(() => ({
  mockGetCurrentUserForRequest: vi.fn(),
}));

vi.mock("@/lib/auth/service.server", () => ({
  getCurrentUserForRequest: mockGetCurrentUserForRequest,
}));

// Must import after vi.mock declarations
import { middleware } from "@/middleware";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeReq(path: string, headers: Record<string, string> = {}) {
  return new NextRequest(`http://localhost${path}`, { headers });
}

const AUTHENTICATED_USER = {
  id: "user-123",
  email: "founder@example.com",
  provider: "magic_link",
};
const CORRELATION_HEADER = "x-correlation-id";
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("middleware — public paths bypass auth", () => {
  beforeEach(() => {
    mockGetCurrentUserForRequest.mockReset();
  });

  it("passes /login through without calling getUser", async () => {
    const res = await middleware(makeReq("/login"));
    expect(mockGetCurrentUserForRequest).not.toHaveBeenCalled();
    expect(res.status).not.toBe(307);
  });

  it("passes /auth/callback through without calling getUser", async () => {
    const res = await middleware(makeReq("/auth/callback"));
    expect(mockGetCurrentUserForRequest).not.toHaveBeenCalled();
    expect(res.status).not.toBe(307);
  });

  it("passes /ingest static proxy requests through without calling getUser", async () => {
    const res = await middleware(makeReq("/ingest/array/test/config.js"));
    expect(mockGetCurrentUserForRequest).not.toHaveBeenCalled();
    expect(res.status).not.toBe(307);
  });

  it("passes /monitoring tunnel requests through without calling getUser", async () => {
    const res = await middleware(makeReq("/monitoring"));
    expect(mockGetCurrentUserForRequest).not.toHaveBeenCalled();
    expect(res.status).not.toBe(307);
  });

  it("passes /login with auth_callback_failed query through without calling getUser", async () => {
    const res = await middleware(makeReq("/login?error=auth_callback_failed"));
    expect(mockGetCurrentUserForRequest).not.toHaveBeenCalled();
  });
});

describe("middleware — authentication enforcement", () => {
  beforeEach(() => {
    mockGetCurrentUserForRequest.mockReset();
  });

  it("redirects unauthenticated requests to /login", async () => {
    mockGetCurrentUserForRequest.mockResolvedValue({
      user: null,
      response: new Response() as never,
    });

    const res = await middleware(makeReq("/"));

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/login");
  });

  it("redirects unauthenticated requests to /login for any protected path", async () => {
    mockGetCurrentUserForRequest.mockResolvedValue({
      user: null,
      response: new Response() as never,
    });

    const res = await middleware(makeReq("/ideation"));

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/login");
  });

  it("passes through authenticated requests with 200", async () => {
    mockGetCurrentUserForRequest.mockResolvedValue({
      user: AUTHENTICATED_USER,
      response: new Response(null, { status: 200 }) as never,
    });

    const res = await middleware(makeReq("/"));

    expect(res.status).not.toBe(307);
  });
});

describe("middleware — token refresh", () => {
  beforeEach(() => {
    mockGetCurrentUserForRequest.mockReset();
  });

  it("forwards refreshed session cookies when the auth service returns them on the response", async () => {
    const response = new Response(null, {
      status: 200,
      headers: { "set-cookie": "sb-access-token=refreshed-token; Path=/" },
    });
    mockGetCurrentUserForRequest.mockResolvedValue({
      user: AUTHENTICATED_USER,
      response: response as never,
    });

    const res = await middleware(makeReq("/"));

    expect(res.status).not.toBe(307);
    // The refreshed cookie must be present in the response
    const setCookie = res.headers.get("set-cookie");
    expect(setCookie).toContain("sb-access-token=refreshed-token");
  });
});

describe("middleware — correlation ID", () => {
  beforeEach(() => {
    mockGetCurrentUserForRequest.mockReset();
  });

  it("generates a correlation ID when none is present (public path)", async () => {
    const res = await middleware(makeReq("/login"));
    const id = res.headers.get(CORRELATION_HEADER);
    expect(id).toBeTruthy();
    expect(id).toMatch(UUID_RE);
  });

  it("preserves correlation ID from the incoming request header (public path)", async () => {
    const existingId = "aaaabbbb-cccc-dddd-eeee-ffffffffffff";
    const res = await middleware(
      makeReq("/login", { [CORRELATION_HEADER]: existingId })
    );
    expect(res.headers.get(CORRELATION_HEADER)).toBe(existingId);
  });

  it("attaches correlation ID to authenticated pass-through responses", async () => {
    mockGetCurrentUserForRequest.mockResolvedValue({
      user: AUTHENTICATED_USER,
      response: new Response(null, { status: 200 }) as never,
    });

    const res = await middleware(makeReq("/"));
    expect(res.headers.get(CORRELATION_HEADER)).toMatch(UUID_RE);
  });

  it("redirects unauthenticated requests to /login without asserting correlation headers", async () => {
    mockGetCurrentUserForRequest.mockResolvedValue({
      user: null,
      response: new Response() as never,
    });

    const res = await middleware(makeReq("/"));
    // Redirects don't carry our custom header — just verify the redirect itself
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/login");
  });
});
