"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { captureMessage } from "@/lib/monitoring";
import { useAnalytics } from "@/lib/analytics/events";
import { emitEvent } from "@/lib/events";
import { getAuthConfig, requestMagicLink, signInWithOAuth } from "@/lib/auth/service";

const CALLBACK_ERROR_MESSAGES: Record<string, string> = {
  auth_callback_failed: "That sign-in link was invalid or has expired. Try again.",
};

export default function LoginPage() {
  const authConfig = getAuthConfig();
  const searchParams = useSearchParams();
  const { capture } = useAnalytics();
  const urlError = searchParams.get("error");
  const callbackErrorMessage = urlError ? CALLBACK_ERROR_MESSAGES[urlError] : null;

  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const result = await requestMagicLink(
      email,
      `${window.location.origin}/auth/callback?provider=magic_link`,
    );

    setLoading(false);

    if (!result.ok) {
      setError(result.error.message);
      return;
    }

    emitEvent("auth.requested_magic_link", { provider: "magic_link" });
    capture("auth.requested_magic_link", { provider: "magic_link" });
    setSubmitted(true);
  }

  async function handleGoogleSignIn() {
    setLoading(true);
    setError(null);

    const result = await signInWithOAuth(
      "google",
      `${window.location.origin}/auth/callback?provider=google`,
    );

    setLoading(false);

    if (!result.ok) {
      setError(result.error.message);
      captureMessage("Google sign-in unavailable", "warning", {
        feature: "auth.login",
        extra: { reason: result.error.code },
      });
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
          <form aria-label="Sign in" onSubmit={handleSubmit} className="mt-6 space-y-4">
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

            {error && (
              <p className="text-sm text-red-600">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-[#0f172a] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {loading ? "Sending…" : "Send magic link"}
            </button>

            {authConfig.providers.some(
              (provider) => provider.id === "google" && provider.enabled,
            ) && (
              <button
                type="button"
                disabled={loading}
                onClick={handleGoogleSignIn}
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 disabled:opacity-50"
              >
                Continue with Google
              </button>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
