import * as Sentry from "@sentry/nextjs";
import {
  PRODUCT_ID,
  SHELL_SLICE_ID,
  getServerSentryEnvironment,
  getServerSentryRelease,
} from "@/lib/sentry";

Sentry.init({
  dsn: process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: Boolean(process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN),
  environment: getServerSentryEnvironment(),
  release: getServerSentryRelease(),
  sendDefaultPii: true,
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1 : 0.1,
  includeLocalVariables: true,
  enableLogs: true,
  initialScope: {
    tags: {
      product_id: PRODUCT_ID,
      slice_id: SHELL_SLICE_ID,
      runtime: "server",
    },
  },
});
