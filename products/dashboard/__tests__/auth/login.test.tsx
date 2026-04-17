/**
 * Tests for components/login-page-client.tsx
 *
 * Covers:
 * - Rendering the email form
 * - Loading state while signInWithOtp is in flight
 * - Success: "check your email" confirmation
 * - Error: auth service returns an error message
 * - Error: callback failure surfaced via ?error= URL param
 * - Re-enabling form after an error so the user can retry
 * - Google button hidden/visible based on auth config
 */

import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";

// ─── Hoisted mocks (must be before vi.mock — hoisted to top of file) ─────────

const {
  mockRequestMagicLink,
  mockSignInWithOAuth,
  mockGetAuthConfig,
  mockCapture,
  mockEmitEvent,
} = vi.hoisted(() => ({
  mockRequestMagicLink: vi.fn(),
  mockSignInWithOAuth: vi.fn(),
  mockGetAuthConfig: vi.fn(() => ({
    enabledProviders: ["magic_link"],
    providers: [
      { id: "magic_link", label: "Magic link", enabled: true },
      { id: "google", label: "Google", enabled: false },
    ],
  })),
  mockCapture: vi.fn(),
  mockEmitEvent: vi.fn(),
}));

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock("@/lib/auth/service", () => ({
  getAuthConfig: mockGetAuthConfig,
  requestMagicLink: mockRequestMagicLink,
  signInWithOAuth: mockSignInWithOAuth,
}));

vi.mock("@/lib/analytics/events", () => ({
  useAnalytics: vi.fn(() => ({ capture: mockCapture })),
}));

vi.mock("@/lib/events", () => ({
  emitEvent: mockEmitEvent,
}));

vi.mock("@/lib/monitoring", () => ({
  captureMessage: vi.fn(),
}));

// ─── Component under test ─────────────────────────────────────────────────────

import { LoginPageClient } from "@/components/login-page-client";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function setup(urlError?: string) {
  return render(<LoginPageClient urlError={urlError} />);
}

function emailInput() {
  return screen.getByLabelText(/email/i);
}

function submitButton() {
  return screen.getByRole("button", { name: /send magic link/i });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

function resetMocks() {
  mockRequestMagicLink.mockReset();
  mockSignInWithOAuth.mockReset();
  mockCapture.mockReset();
  mockEmitEvent.mockReset();
  mockGetAuthConfig.mockReturnValue({
    enabledProviders: ["magic_link"],
    providers: [
      { id: "magic_link", label: "Magic link", enabled: true },
      { id: "google", label: "Google", enabled: false },
    ],
  });
}

describe("LoginPage — rendering", () => {
  beforeEach(resetMocks);

  it("renders an email input and submit button", () => {
    setup();
    expect(emailInput()).toBeInTheDocument();
    expect(submitButton()).toBeInTheDocument();
  });

  it("email input is empty on mount", () => {
    setup();
    expect(emailInput()).toHaveValue("");
  });

  it("submit button is enabled on mount", () => {
    setup();
    expect(submitButton()).not.toBeDisabled();
  });
});

describe("LoginPage — happy path", () => {
  beforeEach(resetMocks);

  it("shows loading state while signInWithOtp is in flight", async () => {
    mockRequestMagicLink.mockReturnValue(new Promise(() => {})); // never resolves
    setup();

    fireEvent.change(emailInput(), { target: { value: "founder@example.com" } });
    fireEvent.click(submitButton());

    // After submission the button label changes to "Sending…" — query by role only
    await waitFor(() => {
      const btn = screen.getByRole("button");
      expect(btn).toHaveTextContent(/sending/i);
      expect(btn).toBeDisabled();
    });
  });

  it("shows confirmation message after successful sign-in", async () => {
    mockRequestMagicLink.mockResolvedValue({
      ok: true,
      data: { provider: "magic_link" },
    });
    setup();

    fireEvent.change(emailInput(), { target: { value: "founder@example.com" } });
    fireEvent.click(submitButton());

    await waitFor(() =>
      expect(screen.getByText(/check your email/i)).toBeInTheDocument()
    );
    expect(screen.queryByRole("button", { name: /send magic link/i })).not.toBeInTheDocument();
  });

  it("calls signInWithOtp with the entered email", async () => {
    mockRequestMagicLink.mockResolvedValue({
      ok: true,
      data: { provider: "magic_link" },
    });
    setup();

    fireEvent.change(emailInput(), { target: { value: "founder@example.com" } });
    fireEvent.click(submitButton());

    await waitFor(() => expect(mockRequestMagicLink).toHaveBeenCalledOnce());
    expect(mockRequestMagicLink).toHaveBeenCalledWith(
      "founder@example.com",
      expect.stringMatching(/\/auth\/callback\?provider=magic_link$/),
    );
  });

  it("includes emailRedirectTo pointing to /auth/callback", async () => {
    mockRequestMagicLink.mockResolvedValue({
      ok: true,
      data: { provider: "magic_link" },
    });
    setup();

    fireEvent.change(emailInput(), { target: { value: "founder@example.com" } });
    fireEvent.click(submitButton());

    await waitFor(() => expect(mockRequestMagicLink).toHaveBeenCalledOnce());
    expect(mockRequestMagicLink.mock.calls[0][1]).toMatch(
      /\/auth\/callback\?provider=magic_link$/,
    );
  });

  it("renders Google sign-in when the provider is enabled", () => {
    mockGetAuthConfig.mockReturnValue({
      enabledProviders: ["magic_link", "google"],
      providers: [
        { id: "magic_link", label: "Magic link", enabled: true },
        { id: "google", label: "Google", enabled: true },
      ],
    });

    setup();

    expect(
      screen.getByRole("button", { name: /continue with google/i }),
    ).toBeInTheDocument();
  });

  it("shows a Google-specific loading state during OAuth sign-in", async () => {
    mockGetAuthConfig.mockReturnValue({
      enabledProviders: ["magic_link", "google"],
      providers: [
        { id: "magic_link", label: "Magic link", enabled: true },
        { id: "google", label: "Google", enabled: true },
      ],
    });
    mockSignInWithOAuth.mockReturnValue(new Promise(() => {}));

    setup();

    fireEvent.click(screen.getByRole("button", { name: /continue with google/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /redirecting/i })).toBeDisabled();
      expect(screen.getByRole("button", { name: /send magic link/i })).toBeDisabled();
    });
  });
});

describe("LoginPage — error handling", () => {
  beforeEach(resetMocks);

  it("shows an error message when signInWithOtp returns an error", async () => {
    mockRequestMagicLink.mockResolvedValue({
      ok: false,
      error: {
        code: "magic_link_request_failed",
        message: "Email rate limit exceeded",
      },
    });
    setup();

    fireEvent.change(emailInput(), { target: { value: "founder@example.com" } });
    fireEvent.click(submitButton());

    await waitFor(() =>
      expect(
        screen.getByText(/we could not send that magic link\. try again\./i),
      ).toBeInTheDocument()
    );
  });

  it("re-enables the submit button after an error", async () => {
    mockRequestMagicLink.mockResolvedValue({
      ok: false,
      error: {
        code: "magic_link_request_failed",
        message: "Something went wrong",
      },
    });
    setup();

    fireEvent.change(emailInput(), { target: { value: "founder@example.com" } });
    fireEvent.click(submitButton());

    await waitFor(() => expect(submitButton()).not.toBeDisabled());
    expect(submitButton()).toHaveTextContent(/send magic link/i);
  });

  it("shows a sanitized error for Google sign-in failures", async () => {
    mockGetAuthConfig.mockReturnValue({
      enabledProviders: ["magic_link", "google"],
      providers: [
        { id: "magic_link", label: "Magic link", enabled: true },
        { id: "google", label: "Google", enabled: true },
      ],
    });
    mockSignInWithOAuth.mockResolvedValue({
      ok: false,
      error: {
        code: "oauth_sign_in_failed",
        message: "provider said no",
      },
    });

    setup();
    fireEvent.click(screen.getByRole("button", { name: /continue with google/i }));

    await waitFor(() =>
      expect(
        screen.getByText(/we could not start that sign-in flow\. try again\./i),
      ).toBeInTheDocument(),
    );
  });

  it("displays an error banner when ?error=auth_callback_failed is in the URL", () => {
    setup("auth_callback_failed");

    expect(
      screen.getByText(/sign-in link (was )?invalid|link expired|try again/i)
    ).toBeInTheDocument();
  });

  it("displays an error banner when ?error=callback_failed is in the URL", () => {
    setup("callback_failed");

    expect(screen.getByTestId("auth-callback-error")).toHaveTextContent(
      /we could not complete sign-in/i,
    );
  });

  it("does not show an error banner when no ?error= param is present", () => {
    setup();

    // No error banner on clean load
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("hides Google sign-in when the provider is disabled", () => {
    setup();

    expect(
      screen.queryByRole("button", { name: /continue with google/i }),
    ).not.toBeInTheDocument();
  });

  it("hides the magic-link form when magic-link auth is disabled", () => {
    mockGetAuthConfig.mockReturnValue({
      enabledProviders: ["google"],
      providers: [
        { id: "magic_link", label: "Magic link", enabled: false },
        { id: "google", label: "Google", enabled: true },
      ],
    });

    setup();

    expect(screen.queryByRole("form", { name: /sign in/i })).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /continue with google/i }),
    ).toBeInTheDocument();
  });

  it("shows an unavailable message when no auth providers are enabled", () => {
    mockGetAuthConfig.mockReturnValue({
      enabledProviders: [],
      providers: [
        { id: "magic_link", label: "Magic link", enabled: false },
        { id: "google", label: "Google", enabled: false },
      ],
    });

    setup();

    expect(screen.getByText(/sign-in is currently unavailable/i)).toBeInTheDocument();
  });
});
