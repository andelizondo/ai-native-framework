import { setMonitoringTag } from "@/lib/monitoring";
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

const CORRELATION_ID_MAX_LEN = 128;
const CORRELATION_ID_PATTERN = /^[A-Za-z0-9._-]+$/;

const UUID_V1_V5_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Accept only well-formed UUID v1–v5; return null for everything else.
 * Use this on inbound server headers before binding to logger context or
 * Sentry tags so malformed values never fragment correlation in Sentry Logs.
 */
export function normalizeCorrelationId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  return UUID_V1_V5_RE.test(value) ? value : null;
}

/** Reject malformed persisted IDs so headers and Sentry tags stay safe and bounded. */
function sanitizeCorrelationId(value: string | null): string | null {
  if (value == null) return null;
  const normalized = value.trim();
  if (
    !normalized ||
    normalized.length > CORRELATION_ID_MAX_LEN ||
    !CORRELATION_ID_PATTERN.test(normalized)
  ) {
    return null;
  }
  return normalized;
}

const FEATURE_TAG_MAX_LEN = 64;

/** Bound Sentry tag cardinality: allow safe chars, cap length, stable fallback. */
export function normalizeObservabilityFeature(feature: string): string {
  const normalized = feature
    .trim()
    .replace(/[^A-Za-z0-9._-]/g, "_")
    .slice(0, FEATURE_TAG_MAX_LEN);
  return normalized || "unknown";
}

export function getBrowserCorrelationId(): string {
  if (typeof window === "undefined") {
    return createCorrelationId();
  }

  const persisted = sanitizeCorrelationId(
    safeSessionGet(CORRELATION_STORAGE_KEY)
  );
  if (persisted) {
    inMemoryCorrelationId = persisted;
    return persisted;
  }

  const cached = sanitizeCorrelationId(inMemoryCorrelationId);
  if (cached) {
    safeSessionSet(CORRELATION_STORAGE_KEY, cached);
    return cached;
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
  const normalizedFeature = normalizeObservabilityFeature(feature);

  setMonitoringTag("product_id", PRODUCT_ID);
  setMonitoringTag("slice_id", SHELL_SLICE_ID);
  setMonitoringTag("feature", normalizedFeature);
  setMonitoringTag("correlation_id", correlationId);
}
