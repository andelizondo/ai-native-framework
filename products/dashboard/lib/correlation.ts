import * as Sentry from "@sentry/nextjs";
import { CORRELATION_HEADER, PRODUCT_ID, SHELL_SLICE_ID } from "@/lib/sentry";

export const CORRELATION_STORAGE_KEY = "dashboard.correlation_id";

let inMemoryCorrelationId: string | null = null;

function createCorrelationId(): string {
  try {
    const c = globalThis.crypto;
    if (c?.randomUUID) {
      return c.randomUUID();
    }
    if (c?.getRandomValues) {
      const bytes = new Uint8Array(16);
      c.getRandomValues(bytes);
      bytes[6] = (bytes[6]! & 0x0f) | 0x40;
      bytes[8] = (bytes[8]! & 0x3f) | 0x80;
      const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
      return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    }
  } catch {
    // fall through to non-crypto stub
  }
  return `corr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`;
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
