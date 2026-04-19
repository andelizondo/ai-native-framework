"use client";

// ─── PART A — Event type registry ────────────────────────────────────────────
//
// Add new events here before using them anywhere in the codebase.
// Names must follow the framework event taxonomy: domain.action_past_tense
// Properties must never include raw email, name, or any PII — user_id only.

// Add product-specific events below as features are built.
// Each entry here should correspond to a catalog entry in spec/examples/*.yaml
export type AnalyticsEvent =
  // ── Auth ──────────────────────────────────────────────────────────────────
  | { event: "auth.requested_magic_link"; properties: { provider: "magic_link" } }
  | {
      event: "user.signed_in";
      properties: { provider: "magic_link" | "google" };
    }
  | {
      event: "user.signed_out";
      properties: { provider: "magic_link" | "google" };
    }
  // ── Generic feature primitives (use when no specific event exists yet) ────
  | { event: "feature.viewed"; properties: { feature_name: string } }
  | {
      event: "feature.action_taken";
      properties: { feature_name: string; action: string };
    }
  // ── Dashboard shell ───────────────────────────────────────────────────────
  | { event: "dashboard.shell_viewed"; properties: { route: string } }
  // ── Workflows ─────────────────────────────────────────────────────────────
  // Catalog source of truth: spec/examples/platform-product.yaml → events
  // catalog → workflow.instance_created. The PostHog payload intentionally
  // drops `company_id` (DEC-002 — single tenant) and `occurred_at` (the
  // structured /api/events envelope owns timestamping); both can rejoin the
  // catalog ingestion path without changing this surface.
  | {
      event: "workflow.instance_created";
      properties: { instance_id: string; template_id: string };
    };

// ─── PART B — Client-side capture hook ───────────────────────────────────────
//
// Feature developers call this. They never touch posthog directly.
//
// Usage in any client component:
//   const { capture } = useAnalytics()
//   capture('feature.action_taken', { feature_name: 'spec-editor', action: 'saved' })

import posthog from "posthog-js";
import { useCallback } from "react";

type AnalyticsEventName = AnalyticsEvent["event"];
type AnalyticsEventProperties<TEvent extends AnalyticsEventName> = Extract<
  AnalyticsEvent,
  { event: TEvent }
>["properties"];

export function useAnalytics() {
  const capture = useCallback(
    <TEvent extends AnalyticsEventName>(
      event: TEvent,
      properties: AnalyticsEventProperties<TEvent>,
    ) => {
      posthog.capture(event, properties as Record<string, unknown>);
    },
    [],
  );

  return { capture };
}
