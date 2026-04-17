import { captureError, createLogger, startSpan } from "@/lib/monitoring";
import {
  applyBrowserObservabilityContext,
  getBrowserCorrelationHeaders,
  getBrowserCorrelationId,
} from "@/lib/correlation";
import { PRODUCT_ID, SHELL_SLICE_ID } from "@/lib/sentry";

/**
 * Client-side event emission helper.
 *
 * Sends structured events to /api/events per the spec event catalog in
 * spec/examples/dashboard-product.yaml. V1 behavior: POST to route handler,
 * which logs to stdout. PostHog integration is a V2 concern.
 *
 * Event names must match the catalog exactly:
 *   - dashboard.shell_viewed
 *   - dashboard.phase_navigated
 *   - auth.requested_magic_link
 *   - user.signed_in
 *   - user.signed_out
 */

type ShellViewedPayload = {
  route: string;
};

type PhaseNavigatedPayload = {
  phase: "ideation" | "design" | "implementation";
};

type AuthProviderPayload = {
  provider: "magic_link" | "google";
};

/**
 * Discriminated map — enforces name/payload pairing at compile time.
 * Adding a new event requires updating this map; TypeScript will catch mismatches.
 */
type EventMap = {
  "dashboard.shell_viewed": ShellViewedPayload;
  "dashboard.phase_navigated": PhaseNavigatedPayload;
  "auth.requested_magic_link": { provider: "magic_link" };
  "user.signed_in": AuthProviderPayload;
  "user.signed_out": AuthProviderPayload;
};

type EventName = keyof EventMap;

/**
 * Emit a structured event to /api/events.
 * Fire-and-forget: errors are logged to console, never thrown.
 *
 * The envelope includes required transport fields per spec/policy/event-taxonomy.yaml:
 * event_name, occurred_at, emitted_by, correlation_id, schema_version.
 * Catalog payload (route / phase only) is nested under `payload`.
 */
export function emitEvent<T extends EventName>(name: T, payload: EventMap[T]): void {
  // Only runs in browser — no-op during SSR
  if (typeof window === "undefined") return;

  const correlationId = getBrowserCorrelationId();
  applyBrowserObservabilityContext(name);

  // Client-side logger — correlation_id from the browser session, feature from the event name.
  const logger = createLogger({ correlation_id: correlationId, feature: name });

  void startSpan(
    {
      name: `event.emit ${name}`,
      op: "feature.event.emit",
      attributes: {
        "app.event_name": name,
        "app.product_id": PRODUCT_ID,
        "app.slice_id": SHELL_SLICE_ID,
        "app.correlation_id": correlationId,
      },
    },
    async () => {
      try {
        const res = await fetch("/api/events", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...getBrowserCorrelationHeaders(),
          },
          body: JSON.stringify({
            event_name: name,
            occurred_at: new Date().toISOString(),
            payload,
            emitted_by: "client",
            schema_version: "1.0.0",
            correlation_id: correlationId,
          }),
        });

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        logger.info("event.emitted", { event_name: name });
      } catch (err) {
        logger.warn("event.emit_failed", { event_name: name });
        captureError(err, {
          feature: name,
          extra: { correlation_id: correlationId },
        });
      }
    }
  );
}
