"use client";

import { useEffect, useRef } from "react";

import { useAnalytics } from "@/lib/analytics/events";

/**
 * OverviewEvents — fires `dashboard.overview_viewed` once per mount.
 *
 * Kept as a tiny client component so the parent server component can
 * stay async/server-rendered. Mirrors the `<ShellEvents />` pattern in
 * `components/shell-events.tsx`.
 *
 * Numbers are passed in (not recomputed) so PostHog matches whatever
 * the user actually saw at first paint, not a value re-derived after
 * hydration changes. A ref guard ensures the event is emitted once per
 * mount even when the parent re-renders with new prop values (e.g. the
 * Overview re-fetches after `revalidatePath` from a checkpoint resolve).
 */
export interface OverviewEventsProps {
  instanceCount: number;
  pendingCount: number;
  activeCount: number;
  completionPct: number;
}

export function OverviewEvents({
  instanceCount,
  pendingCount,
  activeCount,
  completionPct,
}: OverviewEventsProps) {
  const { capture } = useAnalytics();
  const didCaptureRef = useRef(false);

  useEffect(() => {
    if (didCaptureRef.current) return;
    didCaptureRef.current = true;

    capture("dashboard.overview_viewed", {
      instance_count: instanceCount,
      pending_count: pendingCount,
      active_count: activeCount,
      completion_pct: completionPct,
    });
  }, [capture, instanceCount, pendingCount, activeCount, completionPct]);

  return null;
}
