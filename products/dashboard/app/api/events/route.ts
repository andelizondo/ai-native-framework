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
  name: string;
  payload: {
    occurred_at: string;
    [key: string]: unknown;
  };
};

export async function POST(req: NextRequest) {
  let body: EventBody;

  try {
    body = (await req.json()) as EventBody;
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  // Minimal envelope validation
  if (!body.name || typeof body.name !== "string") {
    return NextResponse.json({ error: "missing event name" }, { status: 400 });
  }

  if (!ALLOWED_EVENTS.has(body.name)) {
    return NextResponse.json(
      { error: `unknown event: ${body.name}` },
      { status: 422 }
    );
  }

  if (!body.payload?.occurred_at) {
    return NextResponse.json(
      { error: "payload.occurred_at is required" },
      { status: 400 }
    );
  }

  // V1: structured log to stdout
  const entry = {
    level: "info",
    event: body.name,
    payload: body.payload,
    received_at: new Date().toISOString(),
    product_id: "dashboard",
  };

  console.log(JSON.stringify(entry));

  return NextResponse.json({ ok: true }, { status: 202 });
}
