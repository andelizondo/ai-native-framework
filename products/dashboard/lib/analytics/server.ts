// ─── PART C — Server-side capture helper ─────────────────────────────────────
//
// For route handlers and server components.
// Kept separate from events.ts to prevent posthog-node from entering the client bundle.
//
// Usage:
//   await captureServerEvent(userId, 'user.signed_in', {})

import { withPostHogClient } from "./posthog-server";
import type { AnalyticsEvent } from "./events";
import { getReleaseProperties } from "@/lib/release";

export async function captureServerEvent<E extends AnalyticsEvent>(
  distinctId: string,
  event: E["event"],
  properties: Extract<AnalyticsEvent, { event: E["event"] }>["properties"],
): Promise<void> {
  await withPostHogClient((client) => {
    client.capture({
      distinctId,
      event,
      properties: { ...properties, ...getReleaseProperties() },
    });
    return Promise.resolve();
  });
}
