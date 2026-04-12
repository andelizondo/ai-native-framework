/**
 * POST /api/events
 *
 * V1 event ingestion endpoint. Validates minimal envelope shape and logs
 * events to stdout as structured JSON. PostHog integration is a V2 concern.
 *
 * Spec reference: spec/examples/dashboard-product.yaml → events.catalog
 */

import { NextRequest, NextResponse } from "next/server";

const ALLOWED_EVENTS = new Set([
  "dashboard.shell_viewed",
  "dashboard.phase_navigated",
]);

// Whitelisted payload fields per event name — prevents PII/oversized fields
// from untrusted clients reaching logs.
const ALLOWED_PAYLOAD_FIELDS: Record<string, ReadonlySet<string>> = {
  "dashboard.shell_viewed": new Set(["occurred_at", "route"]),
  "dashboard.phase_navigated": new Set(["occurred_at", "phase"]),
};

type EventBody = {
  event_name: string;
  emitted_by?: string;
  schema_version?: string;
  correlation_id?: string;
  payload: {
    occurred_at: string;
    [key: string]: unknown;
  };
};

/** Clamp a client-supplied string to a max length; reject non-strings and blanks. */
function clampString(value: unknown, max = 64): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

/** Accept only well-formed UUID v1–v5; reject everything else. */
function normalizeCorrelationId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  )
    ? value
    : null;
}

function sanitizePayload(
  eventName: string,
  payload: Record<string, unknown>
): Record<string, unknown> {
  const allowed = ALLOWED_PAYLOAD_FIELDS[eventName];
  if (!allowed) return {};
  return Object.fromEntries(
    Object.entries(payload).filter(([key]) => allowed.has(key))
  );
}

export async function POST(req: NextRequest) {
  let body: EventBody;

  try {
    body = (await req.json()) as EventBody;
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  // Minimal envelope validation
  if (!body.event_name || typeof body.event_name !== "string") {
    return NextResponse.json({ error: "missing event_name" }, { status: 400 });
  }

  if (!ALLOWED_EVENTS.has(body.event_name)) {
    return NextResponse.json(
      { error: `unknown event: ${body.event_name}` },
      { status: 422 }
    );
  }

  if (!body.payload?.occurred_at) {
    return NextResponse.json(
      { error: "payload.occurred_at is required" },
      { status: 400 }
    );
  }

  // V1: structured log to stdout — only log whitelisted payload fields
  const entry = {
    level: "info",
    event_name: body.event_name,
    payload: sanitizePayload(body.event_name, body.payload),
    emitted_by: clampString(body.emitted_by, 32) ?? "client",
    schema_version: clampString(body.schema_version, 16) ?? "1.0.0",
    correlation_id: normalizeCorrelationId(body.correlation_id),
    received_at: new Date().toISOString(),
    product_id: "dashboard",
  };

  console.log(JSON.stringify(entry));

  return NextResponse.json({ ok: true }, { status: 202 });
}
