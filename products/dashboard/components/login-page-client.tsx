"use client";

import { useState, type FormEvent } from "react";
import { captureMessage } from "@/lib/monitoring";
import { useAnalytics } from "@/lib/analytics/events";
import { emitEvent } from "@/lib/events";
import { getAuthConfig, requestMagicLink, signInWithOAuth } from "@/lib/auth/service";
import type { AuthErrorCode } from "@/lib/auth/types";

const AUTH_ERROR_MESSAGES: Record<AuthErrorCode, string> = {
  auth_not_configured:
    "Sign-in is temporarily unavailable in this environment. Try again later.",
  provider_not_enabled: "That sign-in option is currently unavailable.",
  magic_link_request_failed: "We could not send that magic link. Try again.",
  oauth_sign_in_failed: "We could not start that sign-in flow. Try again.",
  callback_failed: "We could not complete sign-in. Try again.",
  sign_out_failed: "We could not sign you out. Try again.",
};

/** Maps `?error=` query values from the auth callback route to user-facing copy. */
const CALLBACK_URL_ERROR_MESSAGES: Record<string, string> = {
  auth_callback_failed: "That sign-in link was invalid or has expired. Try again.",
  callback_failed: AUTH_ERROR_MESSAGES.callback_failed,
};

function getUserSafeAuthError(code: AuthErrorCode): string {
  return AUTH_ERROR_MESSAGES[code];
}

function messageForCallbackUrlError(urlError: string): string {
  return CALLBACK_URL_ERROR_MESSAGES[urlError] ?? AUTH_ERROR_MESSAGES.callback_failed;
}

export function LoginPageClient({ urlError }: { urlError?: string }) {
  const authConfig = getAuthConfig();
  const { capture } = useAnalytics();
  const callbackErrorMessage = urlError ? messageForCallbackUrlError(urlError) : null;
  const isMagicLinkEnabled = authConfig.providers.some(
    (provider) => provider.id === "magic_link" && provider.enabled,
  );
  const isGoogleEnabled = authConfig.providers.some(
    (provider) => provider.id === "google" && provider.enabled,
  );

  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingAction, setLoadingAction] = useState<"magic_link" | "google" | null>(
    null,
  );

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoadingAction("magic_link");
    setError(null);

    try {
      const result = await requestMagicLink(
        email,
        `${window.location.origin}/auth/callback?provider=magic_link`,
      );

      if (!result.ok) {
        setError(getUserSafeAuthError(result.error.code));
        captureMessage("Magic-link sign-in unavailable", "warning", {
          feature: "auth.login",
          extra: { reason: result.error.code },
        });
        return;
      }

      try {
        emitEvent("auth.requested_magic_link", { provider: "magic_link" });
        capture("auth.requested_magic_link", { provider: "magic_link" });
      } catch {
        captureMessage("Magic-link telemetry failed", "warning", {
          feature: "auth.login",
        });
      }
      setSubmitted(true);
    } finally {
      setLoadingAction(null);
    }
  }

  async function handleGoogleSignIn() {
    setLoadingAction("google");
    setError(null);

    try {
      const result = await signInWithOAuth(
        "google",
        `${window.location.origin}/auth/callback?provider=google`,
      );

      if (!result.ok) {
        setError(getUserSafeAuthError(result.error.code));
        captureMessage("Google sign-in unavailable", "warning", {
          feature: "auth.login",
          extra: { reason: result.error.code },
        });
      }
    } finally {
      setLoadingAction(null);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f8fafc]">
      <div className="w-full max-w-sm rounded-2xl border border-[#e2e8f0] bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-[#0f172a]">AI-Native Dashboard</h1>
        <p className="mt-1 text-sm text-[#64748b]">Sign in to your workspace</p>

        {callbackErrorMessage && (
          <div
            role="alert"
            data-testid="auth-callback-error"
            className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700"
          >
            {callbackErrorMessage}
          </div>
        )}

        {submitted ? (
          <div className="mt-6 rounded-lg bg-emerald-50 p-4 text-sm text-emerald-700">
            Check your email — a sign-in link is on its way.
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            {isMagicLinkEnabled && (
              <form aria-label="Sign in" onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label
                    htmlFor="email"
                    className="block text-sm font-medium text-[#374151]"
                  >
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="mt-1 w-full rounded-lg border border-[#d1d5db] px-3 py-2 text-sm text-[#0f172a] outline-none focus:border-[#6366f1] focus:ring-2 focus:ring-[#6366f1]/20"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loadingAction !== null}
                  className="w-full rounded-lg bg-[#0f172a] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                  {loadingAction === "magic_link" ? "Sending…" : "Send magic link"}
                </button>
              </form>
            )}

            {error && (
              <p role="alert" aria-live="polite" className="text-sm text-red-600">
                {error}
              </p>
            )}

            {isGoogleEnabled && (
              <button
                type="button"
                disabled={loadingAction !== null}
                onClick={handleGoogleSignIn}
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 disabled:opacity-50"
              >
                {loadingAction === "google" ? "Redirecting…" : "Continue with Google"}
              </button>
            )}

            {!isMagicLinkEnabled && !isGoogleEnabled && (
              <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
                Sign-in is currently unavailable in this environment.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
