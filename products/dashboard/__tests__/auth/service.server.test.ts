// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const {
  mockGetServerBypassUser,
  mockGetRequestBypassUser,
  mockGetServerUserWithSupabase,
  mockGetMiddlewareUserWithSupabase,
  mockCaptureError,
  mockCaptureMessage,
} = vi.hoisted(() => ({
  mockGetServerBypassUser: vi.fn(),
  mockGetRequestBypassUser: vi.fn(),
  mockGetServerUserWithSupabase: vi.fn(),
  mockGetMiddlewareUserWithSupabase: vi.fn(),
  mockCaptureError: vi.fn(),
  mockCaptureMessage: vi.fn(),
}));

vi.mock("@/lib/auth/test-bypass", () => ({
  getServerBypassUser: mockGetServerBypassUser,
  getRequestBypassUser: mockGetRequestBypassUser,
}));

vi.mock("@/lib/auth/supabase-server-adapter", () => ({
  exchangeCallbackWithSupabase: vi.fn(),
  getServerUserWithSupabase: mockGetServerUserWithSupabase,
  getMiddlewareUserWithSupabase: mockGetMiddlewareUserWithSupabase,
}));

vi.mock("@/lib/monitoring", () => ({
  captureError: mockCaptureError,
  captureMessage: mockCaptureMessage,
}));

import { AuthConfigError } from "@/lib/auth/config";
import { getCurrentUser, getCurrentUserForRequest } from "@/lib/auth/service.server";

describe("auth server service", () => {
  beforeEach(() => {
    mockGetServerBypassUser.mockReset();
    mockGetRequestBypassUser.mockReset();
    mockGetServerUserWithSupabase.mockReset();
    mockGetMiddlewareUserWithSupabase.mockReset();
    mockCaptureError.mockReset();
    mockCaptureMessage.mockReset();
  });

  it("treats missing auth runtime config as unauthenticated on the server", async () => {
    mockGetServerBypassUser.mockResolvedValue(null);
    mockGetServerUserWithSupabase.mockRejectedValue(
      new AuthConfigError("Missing Supabase env"),
    );

    await expect(getCurrentUser()).resolves.toBeNull();
    expect(mockCaptureMessage).toHaveBeenCalledWith(
      "Auth runtime is not configured on the server",
      "warning",
      { feature: "auth.server" },
    );
  });

  it("treats missing auth runtime config as unauthenticated in middleware", async () => {
    mockGetRequestBypassUser.mockReturnValue(null);
    mockGetMiddlewareUserWithSupabase.mockRejectedValue(
      new AuthConfigError("Missing Supabase env"),
    );

    const response = await getCurrentUserForRequest({
      req: new NextRequest("http://localhost/"),
      requestHeaders: new Headers(),
    });

    expect(response.user).toBeNull();
    expect(response.response.status).toBe(200);
    expect(mockCaptureMessage).toHaveBeenCalledWith(
      "Auth runtime is not configured in middleware",
      "warning",
      { feature: "auth.middleware" },
    );
  });
});
