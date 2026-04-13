/**
 * tests/msw/handlers.ts
 *
 * MSW request handlers for unit and component tests.
 * These intercept fetch calls made by client-side code (e.g. emitEvent in lib/events.ts)
 * so tests don't need a running Next.js server.
 *
 * Pattern: handlers return minimal valid responses. Per-test overrides can use
 * server.use(...) to inject error or edge-case responses for specific tests.
 */

import { http, HttpResponse } from "msw";

export const handlers = [
  // POST /api/events — internal audit pipeline
  // emitEvent() in lib/events.ts fires this; we return 202 by default.
  http.post("/api/events", () => {
    return HttpResponse.json({ ok: true, correlation_id: null }, { status: 202 });
  }),
];
