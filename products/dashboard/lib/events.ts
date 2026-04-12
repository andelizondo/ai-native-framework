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
  occurred_at: string;
  route: string;
  correlation_id?: string;
};

type PhaseNavigatedPayload = {
  occurred_at: string;
  phase: "ideation" | "design" | "implementation";
  correlation_id?: string;
};

type EventPayload = ShellViewedPayload | PhaseNavigatedPayload;

type EventName = "dashboard.shell_viewed" | "dashboard.phase_navigated";

/**
 * Emit a structured event to /api/events.
 * Fire-and-forget: errors are logged to console, never thrown.
 */
export function emitEvent(name: EventName, payload: EventPayload): void {
  // Only runs in browser — no-op during SSR
  if (typeof window === "undefined") return;

  fetch("/api/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, payload }),
  }).catch((err) => {
    // Non-blocking: telemetry must never break the UI
    console.warn("[events] emit failed:", name, err);
  });
}
