"use client";

/**
 * ShellEvents — client component, renders nothing.
 *
 * Fires dashboard.shell_viewed on every page mount per the spec event catalog.
 * - emitEvent → internal audit pipeline (/api/events → stdout, correlation_id tagged)
 * - capture   → PostHog (product analytics, EU region, via /ingest proxy)
 *
 * Include once per page.tsx, passing the current route string.
 */

import { useEffect } from "react";
import { emitEvent } from "@/lib/events";
import { useAnalytics } from "@/lib/analytics/events";

export function ShellEvents({ route }: { route: string }) {
  const { capture } = useAnalytics();

  useEffect(() => {
    emitEvent("dashboard.shell_viewed", { route });
    capture("dashboard.shell_viewed", { route });
  }, [route, capture]);

  return null;
}
