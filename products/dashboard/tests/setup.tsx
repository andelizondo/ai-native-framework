/**
 * tests/setup.tsx
 *
 * Global test setup loaded before every test file via vitest.config.ts setupFiles.
 *
 * Responsibilities:
 * - Extends expect with @testing-library/jest-dom matchers
 * - Registers global module mocks for Next.js, PostHog, and Sentry
 * - Manages the MSW Node server lifecycle (start / reset / close)
 *
 * Mock strategy:
 * - next/navigation: stub hooks that components call (usePathname, useRouter)
 * - next/link: render as a plain <a> so tests don't need a full Next.js router context
 * - posthog-js: silence analytics calls in tests; spy where needed in individual tests
 * - @sentry/nextjs: silence error/log calls; startSpan is a passthrough
 */

import "@testing-library/jest-dom";
import React from "react";
import { vi, beforeAll, afterEach, afterAll } from "vitest";
import { server } from "./msw/server";

// ─── Next.js navigation ───────────────────────────────────────────────────────

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(() => "/"),
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  })),
  useSearchParams: vi.fn(() => new URLSearchParams()),
  useParams: vi.fn(() => ({})),
}));

// ─── Next.js Link ─────────────────────────────────────────────────────────────
// Renders as a plain anchor so components can render without a router context.

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    onClick,
    className,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
    onClick?: React.MouseEventHandler<HTMLAnchorElement>;
    className?: string;
    [key: string]: unknown;
  }) =>
    React.createElement("a", { href, onClick, className, ...rest }, children),
}));

// ─── PostHog ──────────────────────────────────────────────────────────────────

vi.mock("posthog-js", () => ({
  default: {
    capture: vi.fn(),
    identify: vi.fn(),
    reset: vi.fn(),
    isFeatureEnabled: vi.fn(() => false),
    init: vi.fn(),
  },
}));

// ─── @sentry/nextjs ───────────────────────────────────────────────────────────
// startSpan is a transparent passthrough — wrapped logic still executes.
// logger stubs silence structured log output in test runs.

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(() => "mock-sentry-event-id"),
  captureMessage: vi.fn(),
  captureRequestError: vi.fn(),
  setUser: vi.fn(),
  setTag: vi.fn(),
  startSpan: vi.fn(
    async (_opts: unknown, fn: () => Promise<unknown>) => fn(),
  ),
  withScope: vi.fn((fn: (scope: unknown) => void) => fn({})),
  addBreadcrumb: vi.fn(),
  flush: vi.fn(() => Promise.resolve(true)),
  init: vi.fn(),
  logger: {
    trace: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn(),
  },
  // MonitoringBoundary uses ErrorBoundary — provide a passthrough wrapper
  ErrorBoundary: ({
    children,
  }: {
    children: React.ReactNode;
    [key: string]: unknown;
  }) => React.createElement(React.Fragment, null, children),
}));

// ─── MSW server lifecycle ─────────────────────────────────────────────────────

beforeAll(() => server.listen({ onUnhandledRequest: "warn" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
