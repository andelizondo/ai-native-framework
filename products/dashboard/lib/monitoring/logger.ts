/**
 * lib/monitoring/logger.ts
 *
 * Structured log pipeline via Sentry Logs (enableLogs: true).
 * All log lines are queryable in Sentry with correlation_id and product tags.
 *
 * Usage (server route handler / server component):
 *   import { createLogger } from "@/lib/monitoring";
 *   import { CORRELATION_HEADER } from "@/lib/sentry";
 *   import { headers } from "next/headers";
 *
 *   const h = await headers();
 *   const logger = createLogger({
 *     correlation_id: h.get(CORRELATION_HEADER) ?? undefined,
 *     feature: "api.events",
 *   });
 *   logger.info("Request received", { path: req.url });
 *
 * Usage (client component):
 *   import { createLogger } from "@/lib/monitoring";
 *   import { getBrowserCorrelationId } from "@/lib/correlation";
 *
 *   const logger = createLogger({
 *     correlation_id: getBrowserCorrelationId(),
 *     feature: "dashboard.ideation",
 *   });
 *   logger.info("Panel opened");
 *
 * Quick logging without context binding (no correlation_id):
 *   import { log } from "@/lib/monitoring";
 *   log.warn("Missing env var", { key: "SENTRY_DSN" });
 */

import * as Sentry from "@sentry/nextjs";
import { PRODUCT_ID, SHELL_SLICE_ID } from "@/lib/sentry";

// ─── Types ────────────────────────────────────────────────────────────────────

/** Scalar attribute values accepted by Sentry Logs. */
export type LogAttributeValue = string | number | boolean;

/** Structured attributes attached to a single log line. */
export type LogAttributes = Record<string, LogAttributeValue | undefined>;

/**
 * Bound context that is stamped on every log line produced by this logger.
 * product_id and slice_id are always added automatically.
 */
export interface LogContext {
  /** Propagated x-correlation-id header value. */
  correlation_id?: string;
  /** Feature/module identifier, e.g. "api.events" or "dashboard.shell". */
  feature?: string;
  /** Any additional attributes to bind to every line. */
  [key: string]: LogAttributeValue | undefined;
}

/** Structured logger interface. Mirrors Sentry log levels. */
export interface Logger {
  trace(message: string, attrs?: LogAttributes): void;
  debug(message: string, attrs?: LogAttributes): void;
  info(message: string, attrs?: LogAttributes): void;
  warn(message: string, attrs?: LogAttributes): void;
  error(message: string, attrs?: LogAttributes): void;
  fatal(message: string, attrs?: LogAttributes): void;
}

// ─── Internals ────────────────────────────────────────────────────────────────

function buildAttrs(
  baseCtx: LogContext,
  callAttrs: LogAttributes | undefined,
): LogAttributes {
  const merged: LogAttributes = {
    product_id: PRODUCT_ID,
    slice_id: SHELL_SLICE_ID,
  };

  for (const [k, v] of Object.entries(baseCtx)) {
    if (v !== undefined) merged[k] = v;
  }

  if (callAttrs) {
    for (const [k, v] of Object.entries(callAttrs)) {
      if (v !== undefined) merged[k] = v;
    }
  }

  return merged;
}

// ─── Factory ──────────────────────────────────────────────────────────────────

/**
 * Create a logger with bound context stamped on every line.
 * Prefer this over the bare `log` singleton when you have a correlation_id
 * or a stable feature context (route handler, server action, component tree).
 */
export function createLogger(context: LogContext = {}): Logger {
  return {
    trace: (msg, attrs) =>
      Sentry.logger.trace(msg, buildAttrs(context, attrs)),
    debug: (msg, attrs) =>
      Sentry.logger.debug(msg, buildAttrs(context, attrs)),
    info: (msg, attrs) => Sentry.logger.info(msg, buildAttrs(context, attrs)),
    warn: (msg, attrs) => Sentry.logger.warn(msg, buildAttrs(context, attrs)),
    error: (msg, attrs) =>
      Sentry.logger.error(msg, buildAttrs(context, attrs)),
    fatal: (msg, attrs) =>
      Sentry.logger.fatal(msg, buildAttrs(context, attrs)),
  };
}

// ─── Default singleton ────────────────────────────────────────────────────────

/**
 * Bare logger without a bound correlation_id.
 * Use for startup logs, build-time messages, or when correlation context is
 * unavailable. Prefer createLogger() in request-scoped code.
 */
export const log: Logger = createLogger();
