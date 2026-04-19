"use client";

/**
 * useSignOut — single sign-out flow for every UI affordance.
 *
 * The standalone <SignOutButton /> and the new sidebar user menu both need
 * the same behaviour (sign out → reset analytics + monitoring identity →
 * clear bypass cookie → /login + router.refresh) and the same failure
 * messaging. Putting that flow in one hook keeps the two surfaces from
 * drifting and means PR-3's user menu inherits every guarantee the
 * sign-out button already has unit-tested.
 *
 * The hook does **not** render the trigger UI; consumers wire `handleSignOut`
 * to whatever button / menu item they own and surface `loading` / `error`
 * however fits the surrounding chrome.
 */

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

const SIGN_OUT_ERROR_MESSAGES: Partial<Record<string, string>> = {
  sign_out_failed: "We could not sign you out. Try again.",
};

function getUserSafeSignOutError(code: string): string {
  return SIGN_OUT_ERROR_MESSAGES[code] ?? "We could not sign you out. Try again.";
}

export function useSignOut(provider: AuthProvider): {
  handleSignOut: () => Promise<void>;
  loading: boolean;
  error: string | null;
} {
  const router = useRouter();
  const { capture } = useAnalytics();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSignOut(): Promise<void> {
    setLoading(true);
    setError(null);

    try {
      const result = await signOut();

      if (!result.ok) {
        setError(getUserSafeSignOutError(result.error.code));
        captureMessage("Sign-out failed in UI", "warning", {
          feature: "auth.sign_out",
          extra: { reason: result.error.code },
        });
        return;
      }

      try {
        emitEvent("user.signed_out", { provider });
        capture("user.signed_out", { provider });
      } catch {
        captureMessage("Sign-out telemetry failed in UI", "warning", {
          feature: "auth.sign_out",
        });
      }

      try {
        resetIdentity();
        clearBypassCookieInBrowser();
        window.sessionStorage.removeItem(LAST_IDENTIFIED_USER_KEY);
      } catch {
        captureMessage("Sign-out cleanup failed in UI", "warning", {
          feature: "auth.sign_out",
        });
      }

      router.replace("/login");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return { handleSignOut, loading, error };
}
