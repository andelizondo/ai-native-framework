import * as Sentry from "@sentry/nextjs";
import { CORRELATION_HEADER, PRODUCT_ID, SHELL_SLICE_ID } from "@/lib/sentry";

export const CORRELATION_STORAGE_KEY = "dashboard.correlation_id";

let inMemoryCorrelationId: string | null = null;

function createCorrelationId(): string {
  return crypto.randomUUID();
}

function safeSessionGet(key: string): string | null {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSessionSet(key: string, value: string): void {
  try {
    window.sessionStorage.setItem(key, value);
  } catch {
    // Ignore storage failures; getBrowserCorrelationId will use in-memory fallback.
  }
}

export function getBrowserCorrelationId(): string {
  if (typeof window === "undefined") {
    return createCorrelationId();
  }

  const existing =
    safeSessionGet(CORRELATION_STORAGE_KEY) ?? inMemoryCorrelationId;
  if (existing) {
    inMemoryCorrelationId = existing;
    return existing;
  }

  const next = createCorrelationId();
  inMemoryCorrelationId = next;
  safeSessionSet(CORRELATION_STORAGE_KEY, next);
  return next;
}

export function getBrowserCorrelationHeaders(): HeadersInit {
  return {
    [CORRELATION_HEADER]: getBrowserCorrelationId(),
  };
}

export function applyBrowserObservabilityContext(feature: string): void {
  const correlationId = getBrowserCorrelationId();

  Sentry.setTag("product_id", PRODUCT_ID);
  Sentry.setTag("slice_id", SHELL_SLICE_ID);
  Sentry.setTag("feature", feature);
  Sentry.setTag("correlation_id", correlationId);
}
