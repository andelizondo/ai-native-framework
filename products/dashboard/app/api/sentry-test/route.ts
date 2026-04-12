import { captureError, createLogger, startSpan, flush } from "@/lib/monitoring";
import { NextResponse } from "next/server";
import {
  CORRELATION_HEADER,
  PRODUCT_ID,
  SHELL_SLICE_ID,
} from "@/lib/sentry";

export async function GET(req: Request) {
  const correlationId = req.headers.get(CORRELATION_HEADER);

  const logger = createLogger({
    correlation_id: correlationId ?? undefined,
    feature: "api.sentry-test",
  });

  return await startSpan(
    {
      name: "GET /api/sentry-test",
      op: "http.server",
      attributes: {
        "app.product_id": PRODUCT_ID,
        "app.slice_id": SHELL_SLICE_ID,
      },
    },
    async () => {
      logger.info("sentry.test.triggered", { route: "/api/sentry-test" });

      const error = new Error("Sentry server test");
      captureError(error, {
        feature: "sentry_test",
        extra: {
          route: "/api/sentry-test",
          ...(correlationId ? { correlation_id: correlationId } : {}),
        },
      });

      logger.error("sentry.test.error_captured", { route: "/api/sentry-test" });

      await flush(2000);

      return NextResponse.json(
        {
          ok: false,
          correlation_id: correlationId,
          message:
            "Captured a server-side test error in Sentry. Check your Sentry project for the new issue.",
        },
        { status: 500 }
      );
    }
  );
}
