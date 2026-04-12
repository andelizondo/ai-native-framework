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

type EventBody = {
  event_name: string;
  occurred_at?: string;
  emitted_by?: string;
  schema_version?: string;
  correlation_id?: string;
  payload: Record<string, unknown>;
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

/** Validate and sanitize catalog payload only (`occurred_at` lives on the envelope per policy). */
function sanitizePayload(
  eventName: string,
  payload: Record<string, unknown>
): Record<string, unknown> | null {
  if (eventName === "dashboard.shell_viewed") {
    const route = clampString(payload.route, 256);
    if (!route) return null;
    return { route };
  }

  if (eventName === "dashboard.phase_navigated") {
    const phase = payload.phase;
    if (
      phase !== "ideation" &&
      phase !== "design" &&
      phase !== "implementation"
    ) {
      return null;
    }
    return { phase };
  }

  return null;
}

export async function POST(req: NextRequest) {
  let parsed: unknown;

  try {
    parsed = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return NextResponse.json({ error: "invalid event envelope" }, { status: 400 });
  }

  const body = parsed as EventBody;

  if (
    body.payload == null ||
    typeof body.payload !== "object" ||
    Array.isArray(body.payload)
  ) {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
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

  const occurredAt = clampString(body.occurred_at, 64);
  if (!occurredAt) {
    return NextResponse.json(
      { error: "occurred_at is required on envelope" },
      { status: 400 }
    );
  }

  // V1: structured log to stdout — validate and sanitize payload before logging
  const sanitizedPayload = sanitizePayload(body.event_name, body.payload);
  if (!sanitizedPayload) {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }

  const entry = {
    level: "info",
    event_name: body.event_name,
    occurred_at: occurredAt,
    payload: sanitizedPayload,
    emitted_by: clampString(body.emitted_by, 32) ?? "client",
    schema_version: clampString(body.schema_version, 16) ?? "1.0.0",
    correlation_id: normalizeCorrelationId(body.correlation_id),
    received_at: new Date().toISOString(),
    product_id: "dashboard",
  };

  console.log(JSON.stringify(entry));

  return NextResponse.json({ ok: true }, { status: 202 });
}
