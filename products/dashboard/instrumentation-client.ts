import * as Sentry from "@sentry/nextjs";
import { CORRELATION_STORAGE_KEY } from "@/lib/correlation";
import {
  CORRELATION_HEADER,
  PRODUCT_ID,
  SHELL_SLICE_ID,
  getClientSentryEnvironment,
  getClientSentryRelease,
} from "@/lib/sentry";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
  environment: getClientSentryEnvironment(),
  release: getClientSentryRelease(),
  sendDefaultPii: true,
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1 : 0.1,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1,
  enableLogs: true,
  integrations: [Sentry.replayIntegration()],
  initialScope: {
    tags: {
      product_id: PRODUCT_ID,
      slice_id: SHELL_SLICE_ID,
      runtime: "client",
    },
  },
  tracePropagationTargets: ["localhost", /^\//],
  beforeSend(event) {
    if (typeof window !== "undefined") {
      const correlationId = window.sessionStorage.getItem(
        CORRELATION_STORAGE_KEY
      );
      if (correlationId) {
        event.tags = {
          ...event.tags,
          correlation_id: correlationId,
        };
      }
    }
    return event;
  },
  beforeBreadcrumb(breadcrumb) {
    if (!breadcrumb.data) return breadcrumb;

    const correlationId =
      typeof window !== "undefined"
        ? window.sessionStorage.getItem(CORRELATION_STORAGE_KEY)
        : null;

    return {
      ...breadcrumb,
      data: {
        ...breadcrumb.data,
        [CORRELATION_HEADER]: correlationId ?? undefined,
      },
    };
  },
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
