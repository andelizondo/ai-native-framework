import { afterEach, describe, expect, it } from "vitest";
import { AUTH_TEST_BYPASS_COOKIE, getRequestBypassUser } from "@/lib/auth/test-bypass";
import { NextRequest } from "next/server";

const ORIGINAL_ENV = {
  AUTH_E2E_BYPASS_SECRET: process.env.AUTH_E2E_BYPASS_SECRET,
  NODE_ENV: process.env.NODE_ENV,
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
  });

  it("returns a bypass user when the cookie secret matches outside production", () => {
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

  it("ignores bypass cookies in production", () => {
    process.env.AUTH_E2E_BYPASS_SECRET = "secret";
    process.env.NODE_ENV = "production";

    expect(
      getRequestBypassUser(
        makeRequest("secret:e2e-user:founder%40example.com"),
      ),
    ).toBeNull();
  });
});
