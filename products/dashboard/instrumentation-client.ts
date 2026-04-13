import * as Sentry from "@sentry/nextjs";
import posthog from "posthog-js";
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

const posthogToken = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;

if (posthogToken) {
  posthog.init(posthogToken, {
    api_host: "/ingest",
    ui_host: "https://eu.posthog.com",
    capture_pageview: "history_change",
    capture_pageleave: true,
    person_profiles: "always",
    session_recording: {
      maskAllInputs: true,
      maskTextSelector: "[data-ph-mask]",
    },
    loaded: (ph) => {
      if (process.env.NODE_ENV === "development") ph.opt_out_capturing();
    },
  });
}
