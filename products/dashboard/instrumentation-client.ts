import * as Sentry from "@sentry/nextjs";
import { getBrowserCorrelationId } from "@/lib/correlation";
import {
  CORRELATION_HEADER,
  PRODUCT_ID,
  SHELL_SLICE_ID,
  getClientSentryEnvironment,
  getClientSentryRelease,
  isSentrySendDefaultPiiEnabled,
} from "@/lib/sentry";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
  environment: getClientSentryEnvironment(),
  release: getClientSentryRelease(),
  sendDefaultPii: isSentrySendDefaultPiiEnabled(),
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
    const correlationId = getBrowserCorrelationId();
    event.tags = {
      ...event.tags,
      correlation_id: correlationId,
    };
    return event;
  },
  beforeBreadcrumb(breadcrumb) {
    const correlationId = getBrowserCorrelationId();

    return {
      ...breadcrumb,
      data: {
        ...(breadcrumb.data ?? {}),
        [CORRELATION_HEADER]: correlationId,
      },
    };
  },
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
