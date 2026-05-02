import { afterEach, describe, expect, it } from "vitest";
import { AUTH_TEST_BYPASS_COOKIE, getRequestBypassUser } from "@/lib/auth/test-bypass";
import { NextRequest } from "next/server";

const ORIGINAL_ENV = {
  AUTH_E2E_BYPASS_SECRET: process.env.AUTH_E2E_BYPASS_SECRET,
  NODE_ENV: process.env.NODE_ENV,
  VERCEL: process.env.VERCEL,
  VERCEL_ENV: process.env.VERCEL_ENV,
};

function makeRequest(cookieValue: string) {
  return new NextRequest("http://localhost/", {
    headers: {
      cookie: `${AUTH_TEST_BYPASS_COOKIE}=${cookieValue}`,
    },
  });
}

describe("auth test bypass", () => {
  afterEach(() => {
    process.env.AUTH_E2E_BYPASS_SECRET = ORIGINAL_ENV.AUTH_E2E_BYPASS_SECRET;
    process.env.NODE_ENV = ORIGINAL_ENV.NODE_ENV;
    process.env.VERCEL = ORIGINAL_ENV.VERCEL;
    process.env.VERCEL_ENV = ORIGINAL_ENV.VERCEL_ENV;
  });

  it("returns a bypass user when the cookie secret matches (non-production deploy)", () => {
    process.env.AUTH_E2E_BYPASS_SECRET = "secret";
    process.env.NODE_ENV = "test";

    expect(
      getRequestBypassUser(
        makeRequest("secret:e2e-user:founder%40example.com"),
      ),
    ).toEqual({
      id: "e2e-user",
      email: "founder@example.com",
      provider: "magic_link",
    });
  });

  it("allows bypass on Vercel preview even when NODE_ENV is production", () => {
    process.env.AUTH_E2E_BYPASS_SECRET = "secret";
    process.env.NODE_ENV = "production";
    process.env.VERCEL = "1";
    process.env.VERCEL_ENV = "preview";

    expect(
      getRequestBypassUser(
        makeRequest("secret:e2e-user:founder%40example.com"),
      ),
    ).toEqual({
      id: "e2e-user",
      email: "founder@example.com",
      provider: "magic_link",
    });
  });

  it("ignores bypass cookies on Vercel production", () => {
    process.env.AUTH_E2E_BYPASS_SECRET = "secret";
    process.env.NODE_ENV = "production";
    process.env.VERCEL = "1";
    process.env.VERCEL_ENV = "production";

    expect(
      getRequestBypassUser(
        makeRequest("secret:e2e-user:founder%40example.com"),
      ),
    ).toBeNull();
  });

  it("ignores bypass cookies for local next start (NODE_ENV production, not Vercel)", () => {
    process.env.AUTH_E2E_BYPASS_SECRET = "secret";
    process.env.NODE_ENV = "production";
    delete process.env.VERCEL;
    delete process.env.VERCEL_ENV;

    expect(
      getRequestBypassUser(
        makeRequest("secret:e2e-user:founder%40example.com"),
      ),
    ).toBeNull();
  });
});
