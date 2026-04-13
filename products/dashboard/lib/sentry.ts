import { getAppRelease } from "@/lib/release";

export const PRODUCT_ID = "dashboard";
export const SHELL_SLICE_ID = "dashboard-shell";
export const CORRELATION_HEADER = "x-correlation-id";

/** Sentry `sendDefaultPii` — only when explicitly opted in (see Sentry data-handling docs). */
export function isSentrySendDefaultPiiEnabled(): boolean {
  return process.env.NEXT_PUBLIC_SENTRY_SEND_DEFAULT_PII === "true";
}

/** Server-only: local variable capture in stack traces — opt-in (can expose secrets). */
export function isSentryIncludeLocalVariablesEnabled(): boolean {
  return process.env.SENTRY_INCLUDE_LOCAL_VARIABLES === "true";
}

function normalizeEnvironment(value: string | undefined): string {
  const normalized = value?.trim();
  if (!normalized) return "development";
  if (normalized === "preview") return "staging";
  return normalized;
}

function normalizeOptionalEnv(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function getClientSentryEnvironment(): string {
  return normalizeEnvironment(
    process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? process.env.NODE_ENV
  );
}

export function getServerSentryEnvironment(): string {
  return normalizeEnvironment(
    process.env.SENTRY_ENVIRONMENT ??
      process.env.VERCEL_ENV ??
      process.env.NODE_ENV
  );
}

export function getClientSentryRelease(): string | undefined {
  return (
    normalizeOptionalEnv(process.env.NEXT_PUBLIC_SENTRY_RELEASE) ??
    getAppRelease()
  );
}

export function getServerSentryRelease(): string | undefined {
  return (
    normalizeOptionalEnv(process.env.SENTRY_RELEASE) ??
    normalizeOptionalEnv(process.env.NEXT_PUBLIC_SENTRY_RELEASE) ??
    getAppRelease()
  );
}
