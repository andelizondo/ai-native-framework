export const PRODUCT_ID = "dashboard";
export const SHELL_SLICE_ID = "dashboard-shell";
export const CORRELATION_HEADER = "x-correlation-id";

function normalizeEnvironment(value: string | undefined): string {
  if (value === "preview") return "staging";
  return value ?? "development";
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
    process.env.NEXT_PUBLIC_SENTRY_RELEASE ??
    process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA
  );
}

export function getServerSentryRelease(): string | undefined {
  return (
    process.env.SENTRY_RELEASE ??
    process.env.VERCEL_GIT_COMMIT_SHA ??
    process.env.NEXT_PUBLIC_SENTRY_RELEASE
  );
}
