import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockRequestMagicLinkWithSupabase,
  mockSignInWithOAuthWithSupabase,
  mockSignOutWithSupabase,
  mockIsAuthProviderEnabled,
  mockGetAuthPublicConfig,
} = vi.hoisted(() => ({
  mockRequestMagicLinkWithSupabase: vi.fn(),
  mockSignInWithOAuthWithSupabase: vi.fn(),
  mockSignOutWithSupabase: vi.fn(),
  mockIsAuthProviderEnabled: vi.fn(() => true),
  mockGetAuthPublicConfig: vi.fn(() => ({
    enabledProviders: ["magic_link"],
    providers: [
      { id: "magic_link", label: "Magic link", enabled: true },
      { id: "google", label: "Google", enabled: false },
    ],
  })),
}));

vi.mock("@/lib/auth/supabase-browser-adapter", () => ({
  requestMagicLinkWithSupabase: mockRequestMagicLinkWithSupabase,
  signInWithOAuthWithSupabase: mockSignInWithOAuthWithSupabase,
  signOutWithSupabase: mockSignOutWithSupabase,
}));

vi.mock("@/lib/auth/config", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth/config")>(
    "@/lib/auth/config",
  );

  return {
    ...actual,
    isAuthProviderEnabled: mockIsAuthProviderEnabled,
    getAuthPublicConfig: mockGetAuthPublicConfig,
  };
});

vi.mock("@/lib/monitoring", () => ({
  captureError: vi.fn(),
  captureMessage: vi.fn(),
}));

import {
  getAuthConfig,
  requestMagicLink,
  signInWithOAuth,
  signOut,
} from "@/lib/auth/service";

describe("auth service", () => {
  beforeEach(() => {
    mockRequestMagicLinkWithSupabase.mockReset();
    mockSignInWithOAuthWithSupabase.mockReset();
    mockSignOutWithSupabase.mockReset();
    mockIsAuthProviderEnabled.mockReturnValue(true);
  });

  it("returns the public auth config", () => {
    expect(getAuthConfig().enabledProviders).toEqual(["magic_link"]);
  });

  it("maps a successful magic-link request", async () => {
    mockRequestMagicLinkWithSupabase.mockResolvedValue({ error: null });

    await expect(
      requestMagicLink("founder@example.com", "http://localhost/auth/callback"),
    ).resolves.toEqual({
      ok: true,
      data: { provider: "magic_link" },
    });
  });

  it("maps a failed magic-link request", async () => {
    mockRequestMagicLinkWithSupabase.mockResolvedValue({
      error: { message: "rate limit" },
    });

    await expect(
      requestMagicLink("founder@example.com", "http://localhost/auth/callback"),
    ).resolves.toEqual({
      ok: false,
      error: {
        code: "magic_link_request_failed",
        message: "rate limit",
      },
    });
  });

  it("fails fast when Google auth is not enabled", async () => {
    mockIsAuthProviderEnabled.mockImplementation((provider: string) => provider !== "google");

    await expect(
      signInWithOAuth("google", "http://localhost/auth/callback?provider=google"),
    ).resolves.toEqual({
      ok: false,
      error: {
        code: "provider_not_enabled",
        message: "google authentication is not enabled for this environment.",
      },
    });
  });

  it("maps a successful sign-out", async () => {
    mockSignOutWithSupabase.mockResolvedValue({ error: null });

    await expect(signOut()).resolves.toEqual({
      ok: true,
      data: { provider: "magic_link" },
    });
  });

  it("maps a sign-out error", async () => {
    mockSignOutWithSupabase.mockResolvedValue({
      error: { message: "network down" },
    });

    await expect(signOut()).resolves.toEqual({
      ok: false,
      error: {
        code: "sign_out_failed",
        message: "network down",
      },
    });
  });
});
