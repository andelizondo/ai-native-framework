import { readFileSync } from "node:fs";
import path from "node:path";
import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";

function normalizeOptionalEnv(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function readRepositoryVersion(): string | undefined {
  try {
    return readFileSync(path.resolve(process.cwd(), "../../version.txt"), "utf8")
      .trim()
      .replace(/^v/, "");
  } catch {
    return undefined;
  }
}

const repositoryVersion = readRepositoryVersion();
const canonicalTag =
  repositoryVersion && repositoryVersion !== "0.0.0"
    ? `v${repositoryVersion}`
    : undefined;

const appRelease =
  normalizeOptionalEnv(process.env.NEXT_PUBLIC_APP_RELEASE) ??
  normalizeOptionalEnv(process.env.APP_RELEASE) ??
  (process.env.VERCEL_ENV === "production" ? canonicalTag : undefined) ??
  normalizeOptionalEnv(process.env.VERCEL_GIT_COMMIT_SHA);

const releaseChannel =
  normalizeOptionalEnv(process.env.NEXT_PUBLIC_RELEASE_CHANNEL) ??
  normalizeOptionalEnv(process.env.APP_RELEASE_CHANNEL) ??
  normalizeOptionalEnv(process.env.VERCEL_ENV) ??
  normalizeOptionalEnv(process.env.NODE_ENV) ??
  "development";

if (appRelease && !process.env.SENTRY_RELEASE) {
  process.env.SENTRY_RELEASE = appRelease;
}

if (appRelease && !process.env.NEXT_PUBLIC_SENTRY_RELEASE) {
  process.env.NEXT_PUBLIC_SENTRY_RELEASE = appRelease;
}

const nextConfig: NextConfig = {
  // product_id: dashboard — ai-native-framework boilerplate
  skipTrailingSlashRedirect: true,
  env: {
    NEXT_PUBLIC_APP_RELEASE: appRelease ?? "",
    NEXT_PUBLIC_RELEASE_CHANNEL: releaseChannel,
  },
  async rewrites() {
    return [
      {
        source: "/ingest/static/:path*",
        destination: "https://eu-assets.i.posthog.com/static/:path*",
      },
      {
        source: "/ingest/:path*",
        destination: "https://eu.i.posthog.com/:path*",
      },
      {
        source: "/ingest/decide",
        destination: "https://eu.i.posthog.com/decide",
      },
    ];
  },
};

const sentryBuildOptions =
  process.env.SENTRY_AUTH_TOKEN &&
  process.env.SENTRY_ORG &&
  process.env.SENTRY_PROJECT
    ? {
        authToken: process.env.SENTRY_AUTH_TOKEN,
        org: process.env.SENTRY_ORG,
        project: process.env.SENTRY_PROJECT,
      }
    : {};

export default withSentryConfig(nextConfig, {
  ...sentryBuildOptions,
  silent: !process.env.CI,
  widenClientFileUpload: true,
  tunnelRoute: "/monitoring",
  webpack: {
    treeshake: {
      removeDebugLogging: true,
    },
  },
});
