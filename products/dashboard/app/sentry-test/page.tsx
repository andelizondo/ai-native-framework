"use client";

import * as Sentry from "@sentry/nextjs";
import {
  applyBrowserObservabilityContext,
  getBrowserCorrelationHeaders,
} from "@/lib/correlation";
import { PRODUCT_ID, SHELL_SLICE_ID } from "@/lib/sentry";

export default function SentryTestPage() {
  return (
    <div className="max-w-2xl space-y-6">
      <div className="rounded-2xl border border-[#e2e8f0] bg-white p-8 shadow-sm">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-[#64748b]">
          Sentry Test
        </p>
        <h1 className="mt-3 text-3xl font-semibold text-[#0f172a]">
          Verify client and server error reporting
        </h1>
        <p className="mt-3 text-sm leading-6 text-[#475569]">
          Use these controls after setting <code>NEXT_PUBLIC_SENTRY_DSN</code>{" "}
          and <code>SENTRY_DSN</code> in{" "}
          <code>products/dashboard/.env.local</code>.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            className="rounded-lg bg-[#0f172a] px-4 py-2 text-sm font-medium text-white"
            onClick={() => {
              applyBrowserObservabilityContext("sentry_test_client");
              Sentry.startSpan(
                {
                  name: "ui.sentry_test.client",
                  op: "ui.action",
                  attributes: {
                    "app.product_id": PRODUCT_ID,
                    "app.slice_id": SHELL_SLICE_ID,
                  },
                },
                () => {
                  throw new Error("Sentry client test");
                }
              );
            }}
          >
            Trigger client error
          </button>

          <button
            className="rounded-lg border border-[#cbd5e1] bg-white px-4 py-2 text-sm font-medium text-[#0f172a]"
            onClick={async () => {
              applyBrowserObservabilityContext("sentry_test_server");
              await Sentry.startSpan(
                {
                  name: "ui.sentry_test.server",
                  op: "ui.action",
                  attributes: {
                    "app.product_id": PRODUCT_ID,
                    "app.slice_id": SHELL_SLICE_ID,
                  },
                },
                async () => {
                  const response = await fetch("/api/sentry-test", {
                    headers: getBrowserCorrelationHeaders(),
                  });
                  const data = (await response.json()) as {
                    message?: string;
                    correlation_id?: string;
                  };
                  Sentry.addBreadcrumb({
                    category: "sentry-test",
                    level: "info",
                    message: data.message ?? "Triggered server test route",
                    data: {
                      correlation_id: data.correlation_id,
                    },
                  });
                  alert(data.message ?? "Triggered server test route");
                }
              );
            }}
          >
            Trigger server error
          </button>
        </div>
      </div>
    </div>
  );
}
