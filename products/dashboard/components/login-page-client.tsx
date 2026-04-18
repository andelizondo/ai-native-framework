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
    if (loadingAction !== null) return;
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
    if (loadingAction !== null) return;
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
    <div className="relative flex min-h-dvh w-full flex-col items-center justify-center overflow-x-hidden overflow-y-auto bg-[#0f172a] px-4 py-8">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {/* Radial glow */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(ellipse 90% 60% at 50% -10%, rgba(99,102,241,0.18) 0%, transparent 70%)",
          }}
        />
        {/* Dot grid */}
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              "radial-gradient(circle, rgba(255,255,255,0.25) 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />
      </div>

      {/* Card */}
      <div className="relative z-10 w-full max-w-sm">
        {/* Brand lockup above card */}
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-lg shadow-black/30">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-6 w-6 text-slate-900"
              aria-hidden="true"
            >
              <rect x="3" y="3" width="7" height="9" rx="1" />
              <rect x="14" y="3" width="7" height="5" rx="1" />
              <rect x="14" y="12" width="7" height="9" rx="1" />
              <rect x="3" y="16" width="7" height="5" rx="1" />
            </svg>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-indigo-400">
              AI-Native Framework
            </p>
          </div>
        </div>

        <div className="rounded-2xl bg-gradient-to-b from-white/20 to-white/5 p-px shadow-2xl shadow-black/50">
          <div className="rounded-2xl bg-white px-8 py-8">
            <div className="mb-6">
              <h1 className="text-xl font-semibold tracking-tight text-slate-900">
                AI-Native Dashboard
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Welcome back. Sign in to continue to your workspace.
              </p>
            </div>

            {!submitted && callbackErrorMessage && (
              <div
                role="alert"
                data-testid="auth-callback-error"
                className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
              >
                {callbackErrorMessage}
              </div>
            )}

            {submitted ? (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
                Check your email — a sign-in link is on its way.
              </div>
            ) : (
              <div className="space-y-3">
                {isMagicLinkEnabled && (
                  <form aria-label="Sign in" onSubmit={handleSubmit} className="space-y-3">
                    <div>
                      <label
                        htmlFor="email"
                        className="block text-sm font-medium text-slate-700"
                      >
                        Email address
                      </label>
                      <input
                        id="email"
                        type="email"
                        required
                        disabled={loadingAction !== null}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        className="mt-1.5 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/15 disabled:opacity-50"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={loadingAction !== null}
                      className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-800 disabled:opacity-50"
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

                {isMagicLinkEnabled && isGoogleEnabled && (
                  <div className="relative my-1 flex items-center gap-3">
                    <div className="h-px flex-1 bg-slate-200" />
                    <span className="text-xs text-slate-600">or</span>
                    <div className="h-px flex-1 bg-slate-200" />
                  </div>
                )}

                {isGoogleEnabled && (
                  <button
                    type="button"
                    disabled={loadingAction !== null}
                    onClick={handleGoogleSignIn}
                    className="flex w-full items-center justify-center gap-2.5 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
                  >
                    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" aria-hidden="true">
                      <path
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        fill="#4285F4"
                      />
                      <path
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        fill="#34A853"
                      />
                      <path
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                        fill="#FBBC05"
                      />
                      <path
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                        fill="#EA4335"
                      />
                    </svg>
                    {loadingAction === "google" ? "Redirecting…" : "Continue with Google"}
                  </button>
                )}

                {!isMagicLinkEnabled && !isGoogleEnabled && (
                  <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">
                    Sign-in is currently unavailable in this environment.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-slate-300">
          Spec-first · Agent-driven · Human-approved
        </p>
      </div>
    </div>
  );
}
