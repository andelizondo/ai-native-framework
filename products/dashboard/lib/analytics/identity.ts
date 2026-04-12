"use client";

import posthog from "posthog-js";
import {
  setMonitoringUser,
  clearMonitoringUser,
} from "@/lib/monitoring";

// Call on successful sign-in. distinctId must be the user's UUID from Supabase auth.
// Never pass email or name — user_id only per framework PII policy.
// Sets identity on both PostHog and Sentry from a single call.
export function identifyUser(
  userId: string,
  traits?: {
    plan?: "free" | "pro";
    created_at?: string; // ISO date string only — not a timestamp with PII
  },
) {
  posthog.identify(userId, traits);
  setMonitoringUser(userId);
}

// Call on sign-out. Clears identity on both PostHog and Sentry.
export function resetIdentity() {
  posthog.reset();
  clearMonitoringUser();
}
