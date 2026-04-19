/**
 * POST /api/events
 *
 * V1 event ingestion endpoint. Validates minimal envelope shape and logs
 * events to stdout as structured JSON. PostHog integration is a V2 concern.
 *
 * Spec reference: spec/examples/dashboard-product.yaml → events.catalog
 */

import { NextRequest, NextResponse } from "next/server";
import { captureError, createLogger, startSpan, setMonitoringTag } from "@/lib/monitoring";
import { normalizeCorrelationId } from "@/lib/correlation";
import {
  CORRELATION_HEADER,
  PRODUCT_ID,
  SHELL_SLICE_ID,
} from "@/lib/sentry";

const ALLOWED_EVENTS = new Set([
  "dashboard.shell_viewed",
  "auth.requested_magic_link",
  "user.signed_in",
  "user.signed_out",
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

  if (eventName === "auth.requested_magic_link") {
    if (payload.provider !== "magic_link") {
      return null;
    }

    return { provider: "magic_link" };
  }

  if (eventName === "user.signed_in" || eventName === "user.signed_out") {
    if (payload.provider !== "magic_link" && payload.provider !== "google") {
      return null;
    }

    return { provider: payload.provider };
  }

  return null;
}

export async function POST(req: NextRequest) {
  // Normalize the header once so every downstream use (logger, tags, response)
  // shares a single validated value and the raw input never re-enters.
  let correlationId: string | null = normalizeCorrelationId(
    req.headers.get(CORRELATION_HEADER)
  );

  const logger = createLogger({
    correlation_id: correlationId ?? undefined,
    feature: "api.events",
  });

  try {
    return await startSpan(
      {
        name: "POST /api/events",
        op: "http.server",
        attributes: {
          "app.product_id": PRODUCT_ID,
          "app.slice_id": SHELL_SLICE_ID,
        },
      },
      async () => {
        let parsed: unknown;

        try {
          parsed = await req.json();
        } catch {
          logger.warn("event.rejected", { reason: "invalid_json" });
          return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
        }

        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          logger.warn("event.rejected", { reason: "invalid_envelope" });
          return NextResponse.json(
            { error: "invalid event envelope" },
            { status: 400 }
          );
        }

        const body = parsed as EventBody;

        if (
          body.payload == null ||
          typeof body.payload !== "object" ||
          Array.isArray(body.payload)
        ) {
          logger.warn("event.rejected", { reason: "invalid_payload" });
          return NextResponse.json({ error: "invalid payload" }, { status: 400 });
        }

        if (!body.event_name || typeof body.event_name !== "string") {
          logger.warn("event.rejected", { reason: "missing_event_name" });
          return NextResponse.json(
            { error: "missing event_name" },
            { status: 400 }
          );
        }

        if (!ALLOWED_EVENTS.has(body.event_name)) {
          logger.warn("event.rejected", {
            reason: "unknown_event",
            event_name: body.event_name,
          });
          return NextResponse.json(
            { error: `unknown event: ${body.event_name}` },
            { status: 422 }
          );
        }

        const occurredAt = clampString(body.occurred_at, 64);
        if (!occurredAt) {
          logger.warn("event.rejected", { reason: "missing_occurred_at" });
          return NextResponse.json(
            { error: "occurred_at is required on envelope" },
            { status: 400 }
          );
        }

        const sanitizedPayload = sanitizePayload(body.event_name, body.payload);
        if (!sanitizedPayload) {
          logger.warn("event.rejected", {
            reason: "invalid_catalog_payload",
            event_name: body.event_name,
          });
          return NextResponse.json({ error: "invalid payload" }, { status: 400 });
        }

        const emittedBy = clampString(body.emitted_by, 32) ?? "client";
        const schemaVersion = clampString(body.schema_version, 16) ?? "1.0.0";
        const resolvedCorrelationId =
          normalizeCorrelationId(body.correlation_id) ?? correlationId;

        correlationId = resolvedCorrelationId;
        setMonitoringTag("product_id", PRODUCT_ID);
        setMonitoringTag("slice_id", SHELL_SLICE_ID);
        setMonitoringTag("feature", body.event_name);
        if (correlationId) {
          setMonitoringTag("correlation_id", correlationId);
        }

        logger.info("event.received", {
          event_name: body.event_name,
          occurred_at: occurredAt,
          emitted_by: emittedBy,
          schema_version: schemaVersion,
          correlation_id: resolvedCorrelationId ?? undefined,
        });

        return NextResponse.json(
          { ok: true, correlation_id: correlationId },
          { status: 202 }
        );
      }
    );
  } catch (error) {
    logger.error("event.handler_error", {
      correlation_id: correlationId ?? undefined,
    });
    captureError(error, {
      feature: "events_api",
      extra: { ...(correlationId ? { correlation_id: correlationId } : {}) },
    });

    return NextResponse.json(
      { error: "internal server error" },
      { status: 500 }
    );
  }
}
