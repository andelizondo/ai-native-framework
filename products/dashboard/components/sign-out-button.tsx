"use client";

import type { AuthProvider } from "@/lib/auth/types";
import { useSignOut } from "@/lib/auth/use-sign-out";

/**
 * Standalone sign-out affordance.
 *
 * Kept as a public component so login/test-only surfaces and pre-shell
 * layouts that don't render the new sidebar user menu can still trigger a
 * sign-out. The behaviour (analytics, monitoring, bypass-cookie cleanup,
 * /login redirect) lives in `useSignOut` so the user menu and this button
 * can never disagree about what "sign out" means.
 */
export function SignOutButton({ provider }: { provider: AuthProvider }) {
  const { handleSignOut, loading, error } = useSignOut(provider);

  return (
    <div className="flex items-center gap-2">
      {error && (
        <span
          id="signout-error"
          role="alert"
          aria-live="polite"
          className="text-xs text-red-600"
        >
          {error}
        </span>
      )}
      <button
        type="button"
        onClick={handleSignOut}
        disabled={loading}
        aria-describedby={error ? "signout-error" : undefined}
        className="rounded-lg border border-border bg-bg-2 px-3 py-1.5 text-xs font-medium text-t2 hover:bg-bg-3 hover:text-t1 disabled:opacity-50 transition-colors"
      >
        {loading ? "Signing out…" : "Sign out"}
      </button>
    </div>
  );
}
