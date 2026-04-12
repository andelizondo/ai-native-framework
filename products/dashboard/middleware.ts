import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { CORRELATION_HEADER } from "@/lib/sentry";

export function middleware(req: NextRequest) {
  const requestHeaders = new Headers(req.headers);
  const correlationId =
    requestHeaders.get(CORRELATION_HEADER) ?? crypto.randomUUID();

  requestHeaders.set(CORRELATION_HEADER, correlationId);

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  response.headers.set(CORRELATION_HEADER, correlationId);
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
