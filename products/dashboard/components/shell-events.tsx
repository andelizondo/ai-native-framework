"use client";

/**
 * ShellEvents — client component, renders nothing.
 *
 * Fires `dashboard.shell_viewed` on every page mount per the spec event
 * catalog and tags the active Sentry scope with the `workflow_canvas`
 * component, which is the slice the new shell hosts (today as the
 * Overview placeholder, in later PRs as the real workflow tree). Tagging
 * here keeps every error / span captured during a shell view scoped to
 * the same component without each leaf surface having to remember.
 *
 * - emitEvent → internal audit pipeline (/api/events → stdout, correlation_id tagged)
 * - capture   → PostHog (product analytics, EU region, via /ingest proxy)
 *
 * Include once per page.tsx, passing the current route string.
 */

import { useEffect } from "react";

import { emitEvent } from "@/lib/events";
import { useAnalytics } from "@/lib/analytics/events";
import { setMonitoringTag } from "@/lib/monitoring";

export const SHELL_COMPONENT_TAG = "workflow_canvas";

export function ShellEvents({ route }: { route: string }) {
  const { capture } = useAnalytics();

  useEffect(() => {
    setMonitoringTag("component", SHELL_COMPONENT_TAG);
    emitEvent("dashboard.shell_viewed", { route });
    capture("dashboard.shell_viewed", { route });
  }, [route, capture]);

  return null;
}
