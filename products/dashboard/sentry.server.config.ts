import * as Sentry from "@sentry/nextjs";
import { getAppRelease } from "@/lib/release";
import {
  PRODUCT_ID,
  SHELL_SLICE_ID,
  getServerSentryEnvironment,
  getServerSentryRelease,
  isSentryIncludeLocalVariablesEnabled,
  isSentrySendDefaultPiiEnabled,
} from "@/lib/sentry";

const appRelease = getAppRelease();

Sentry.init({
  dsn: process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: Boolean(process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN),
  environment: getServerSentryEnvironment(),
  release: getServerSentryRelease(),
  sendDefaultPii: isSentrySendDefaultPiiEnabled(),
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1 : 0.1,
  includeLocalVariables: isSentryIncludeLocalVariablesEnabled(),
  enableLogs: true,
  initialScope: {
    tags: {
      product_id: PRODUCT_ID,
      slice_id: SHELL_SLICE_ID,
      runtime: "server",
      ...(appRelease ? { app_release: appRelease } : {}),
    },
  },
});
