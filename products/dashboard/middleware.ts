import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { CORRELATION_HEADER } from "@/lib/sentry";
import { getCurrentUserForRequest } from "@/lib/auth/service.server";

const PUBLIC_PATH_PREFIXES = ["/login", "/auth/callback", "/ingest", "/monitoring"];

export async function middleware(req: NextRequest) {
  // Inject / propagate correlation ID
  const requestHeaders = new Headers(req.headers);
  const correlationId =
    requestHeaders.get(CORRELATION_HEADER) ?? crypto.randomUUID();
  requestHeaders.set(CORRELATION_HEADER, correlationId);

  // Skip auth check for public paths
  const { pathname } = req.nextUrl;
  if (PUBLIC_PATH_PREFIXES.some((p) => pathname.startsWith(p))) {
    const response = NextResponse.next({ request: { headers: requestHeaders } });
    response.headers.set(CORRELATION_HEADER, correlationId);
    return response;
  }

  const { user, response } = await getCurrentUserForRequest({
    req,
    requestHeaders,
  });

  if (!user) {
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = "/login";
    return NextResponse.redirect(loginUrl);
  }

  response.headers.set(CORRELATION_HEADER, correlationId);
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|ingest|monitoring).*)"],
};
