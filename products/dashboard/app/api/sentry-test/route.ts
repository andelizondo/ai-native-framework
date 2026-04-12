import * as Sentry from "@sentry/nextjs";
import { NextResponse } from "next/server";
import {
  CORRELATION_HEADER,
  PRODUCT_ID,
  SHELL_SLICE_ID,
} from "@/lib/sentry";

export async function GET(req: Request) {
  const correlationId = req.headers.get(CORRELATION_HEADER);

  return await Sentry.startSpan(
    {
      name: "GET /api/sentry-test",
      op: "http.server",
      attributes: {
        "app.product_id": PRODUCT_ID,
        "app.slice_id": SHELL_SLICE_ID,
      },
    },
    async () => {
      const error = new Error("Sentry server test");
      Sentry.withScope((scope) => {
        scope.setTag("product_id", PRODUCT_ID);
        scope.setTag("slice_id", SHELL_SLICE_ID);
        scope.setTag("feature", "sentry_test");
        scope.setTag("route", "/api/sentry-test");
        if (correlationId) {
          scope.setTag("correlation_id", correlationId);
        }
        Sentry.captureException(error);
      });

      await Sentry.flush(2000);

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
