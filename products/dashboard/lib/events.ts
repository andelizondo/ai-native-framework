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
 */

type ShellViewedPayload = {
  route: string;
};

type PhaseNavigatedPayload = {
  phase: "ideation" | "design" | "implementation";
};

/**
 * Discriminated map — enforces name/payload pairing at compile time.
 * Adding a new event requires updating this map; TypeScript will catch mismatches.
 */
type EventMap = {
  "dashboard.shell_viewed": ShellViewedPayload;
  "dashboard.phase_navigated": PhaseNavigatedPayload;
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

  void fetch("/api/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      event_name: name,
      occurred_at: new Date().toISOString(),
      payload,
      emitted_by: "client",
      schema_version: "1.0.0",
      correlation_id: crypto.randomUUID(),
    }),
  })
    .then((res) => {
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
    })
    .catch((err) => {
      // Non-blocking: telemetry must never break the UI
      console.warn("[events] emit failed:", name, err);
    });
}
