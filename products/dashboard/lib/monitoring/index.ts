/**
 * lib/monitoring/index.ts
 *
 * Single import surface for all error and performance monitoring.
 * Feature code imports from here only — never from @sentry/nextjs directly.
 *
 * Files that legitimately import @sentry/nextjs directly (SDK integration, not feature code):
 *   - sentry.server.config.ts  — server-side Sentry init
 *   - sentry.edge.config.ts    — edge-runtime Sentry init
 *   - instrumentation-client.ts — client-side Sentry init + Next.js router hooks
 *   - next.config.ts           — build-time withSentryConfig wrapper
 *
 * Everything else goes through this file.
 */

import * as Sentry from "@sentry/nextjs";

// ─── Structured error capture ─────────────────────────────────────────────────

/**
 * Capture an unexpected error with structured context.
 * Always use this instead of Sentry.captureException() directly.
 *
 * Returns the Sentry event ID so it can be cross-linked into logs.
 */
export function captureError(
  error: unknown,
  context?: {
    feature?: string; // which feature/module the error originated in
    action?: string; // what the user was doing
    userId?: string; // Supabase UUID only — never email or name
    extra?: Record<string, unknown>;
  },
): string {
  return Sentry.captureException(error, {
    tags: {
      ...(context?.feature ? { feature: context.feature } : {}),
      ...(context?.action ? { action: context.action } : {}),
    },
    user: context?.userId ? { id: context.userId } : undefined,
    extra: context?.extra,
  });
}

/**
 * Capture a non-fatal signal — degraded state, unexpected condition, business
 * rule violation — that is not an exception but should be visible in Sentry.
 *
 * Use sparingly for 'info'. PostHog is the right tool for business events.
 */
export function captureWarning(
  message: string,
  context?: {
    feature?: string;
    userId?: string;
    extra?: Record<string, unknown>;
  },
): void {
  Sentry.captureMessage(message, {
    level: "warning",
    tags: { ...(context?.feature ? { feature: context.feature } : {}) },
    user: context?.userId ? { id: context.userId } : undefined,
    extra: context?.extra,
  });
}

export function captureMessage(
  message: string,
  level: "info" | "warning" | "error" = "warning",
  context?: {
    feature?: string;
    userId?: string;
    extra?: Record<string, unknown>;
  },
): void {
  Sentry.captureMessage(message, {
    level,
    tags: { ...(context?.feature ? { feature: context.feature } : {}) },
    user: context?.userId ? { id: context.userId } : undefined,
    extra: context?.extra,
  });
}

// ─── Identity ─────────────────────────────────────────────────────────────────

/**
 * Set user context for the current session.
 * Call on sign-in alongside identifyUser() in lib/analytics/identity.ts.
 * Accepts Supabase UUID only — never email or name.
 */
export function setMonitoringUser(userId: string): void {
  Sentry.setUser({ id: userId });
}

/** Call on sign-out alongside resetIdentity() in lib/analytics/identity.ts. */
export function clearMonitoringUser(): void {
  Sentry.setUser(null);
}

// ─── Tagging ──────────────────────────────────────────────────────────────────

/**
 * Set a tag that will appear on all subsequent events in this session.
 * Use for feature context that spans multiple operations.
 */
export function setMonitoringTag(key: string, value: string): void {
  Sentry.setTag(key, value);
}

// ─── Tracing primitives (pass-throughs) ───────────────────────────────────────
//
// Re-exported so feature code never imports @sentry/nextjs directly for tracing.
// If Sentry is ever replaced, only this file changes.

export const startSpan = Sentry.startSpan;
export const withScope = Sentry.withScope;
export const addBreadcrumb = Sentry.addBreadcrumb;
export const flush = Sentry.flush;

// ─── Next.js instrumentation hook re-exports ─────────────────────────────────

export const captureRequestError = Sentry.captureRequestError;

// ─── Structured log pipeline ──────────────────────────────────────────────────
//
// Routed through Sentry Logs (enableLogs: true in all runtime configs).
// All log lines are queryable in Sentry with correlation_id and product tags.
//
// createLogger(context) — bind correlation_id + feature to a request scope.
// log                   — bare singleton for startup / build-time messages.

export {
  createLogger,
  log,
  type Logger,
  type LogContext,
  type LogAttributes,
  type LogAttributeValue,
} from "./logger";
