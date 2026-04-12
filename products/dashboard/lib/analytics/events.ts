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
  | { event: "user.signed_up"; properties: { plan: "free" | "pro" } }
  | { event: "user.signed_in"; properties: Record<string, never> }
  | { event: "user.signed_out"; properties: Record<string, never> }
  // ── Generic feature primitives (use when no specific event exists yet) ────
  | { event: "feature.viewed"; properties: { feature_name: string } }
  | {
      event: "feature.action_taken";
      properties: { feature_name: string; action: string };
    }
  // ── Dashboard shell ───────────────────────────────────────────────────────
  | { event: "dashboard.shell_viewed"; properties: { route: string } }
  | {
      event: "dashboard.phase_navigated";
      properties: {
        phase: "ideation" | "design" | "implementation";
      };
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
