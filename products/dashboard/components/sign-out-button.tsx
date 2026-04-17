"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAnalytics } from "@/lib/analytics/events";
import { emitEvent } from "@/lib/events";
import { resetIdentity } from "@/lib/analytics/identity";
import { captureMessage } from "@/lib/monitoring";
import { signOut } from "@/lib/auth/service";
import { clearBypassCookieInBrowser } from "@/lib/auth/test-bypass.client";
import type { AuthProvider } from "@/lib/auth/types";

const LAST_IDENTIFIED_USER_KEY = "dashboard:last_identified_user";

export function SignOutButton({ provider }: { provider: AuthProvider }) {
  const router = useRouter();
  const { capture } = useAnalytics();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSignOut() {
    setLoading(true);
    setError(null);

    const result = await signOut();
    setLoading(false);

    if (!result.ok) {
      setError(result.error.message);
      captureMessage("Sign-out failed in UI", "warning", {
        feature: "auth.sign_out",
        extra: { reason: result.error.code },
      });
      return;
    }

    emitEvent("user.signed_out", { provider });
    capture("user.signed_out", { provider });
    resetIdentity();
    clearBypassCookieInBrowser();
    window.sessionStorage.removeItem(LAST_IDENTIFIED_USER_KEY);
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2">
      {error && <span className="text-xs text-red-600">{error}</span>}
      <button
        type="button"
        onClick={handleSignOut}
        disabled={loading}
        className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 disabled:opacity-50"
      >
        {loading ? "Signing out…" : "Sign out"}
      </button>
    </div>
  );
}
