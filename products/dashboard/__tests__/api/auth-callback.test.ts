// @vitest-environment node
/**
 * Tests for app/auth/callback/route.ts (GET /auth/callback)
 *
 * Covers:
 * - Successful code exchange → redirect to /
 * - Missing code param → redirect to /login?error=auth_callback_failed
 * - exchangeCodeForSession failure → redirect to /login?error=auth_callback_failed
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Auth service mock ────────────────────────────────────────────────────────

const { mockExchangeCallback } = vi.hoisted(() => ({
  mockExchangeCallback: vi.fn(),
}));

vi.mock("@/lib/auth/service.server", () => ({
  exchangeCallback: mockExchangeCallback,
}));

vi.mock("@/lib/monitoring", () => ({
  captureMessage: vi.fn(),
}));

// Must import after vi.mock declarations
import { GET } from "@/app/auth/callback/route";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeCallbackRequest(params: Record<string, string> = {}) {
  const url = new URL("http://localhost/auth/callback");
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  return new Request(url.toString());
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("GET /auth/callback — happy path", () => {
  beforeEach(() => mockExchangeCallback.mockReset());

  it("exchanges the code and redirects to /", async () => {
    mockExchangeCallback.mockResolvedValue({
      ok: true,
      data: { provider: "magic_link", user: { id: "user-123", email: null } },
    });

    const res = await GET(makeCallbackRequest({ code: "abc123" }));

    expect(mockExchangeCallback).toHaveBeenCalledWith(
      "http://localhost/auth/callback?code=abc123",
    );
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost/");
  });
});

describe("GET /auth/callback — error cases", () => {
  beforeEach(() => mockExchangeCallback.mockReset());

  it("redirects to /login?error=auth_callback_failed when code param is missing", async () => {
    mockExchangeCallback.mockResolvedValue({
      ok: false,
      error: { code: "callback_failed", message: "Missing code" },
    });

    const res = await GET(makeCallbackRequest({}));

    expect(mockExchangeCallback).toHaveBeenCalledOnce();
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/login");
    expect(res.headers.get("location")).toContain("error=auth_callback_failed");
  });

  it("redirects to /login?error=auth_callback_failed when exchange returns an error", async () => {
    mockExchangeCallback.mockResolvedValue({
      ok: false,
      error: { code: "callback_failed", message: "invalid grant" },
    });

    const res = await GET(makeCallbackRequest({ code: "expired-code" }));

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/login");
    expect(res.headers.get("location")).toContain("error=auth_callback_failed");
  });

  it("redirects to /login?error=auth_callback_failed when exchange returns unexpected data", async () => {
    mockExchangeCallback.mockResolvedValue({
      ok: false,
      error: { code: "auth_not_configured", message: "Missing env" },
    });

    const res = await GET(makeCallbackRequest({ code: "bad-code" }));

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/login");
    expect(res.headers.get("location")).toContain("error=auth_callback_failed");
  });
});
