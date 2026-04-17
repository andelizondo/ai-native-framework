import { afterEach, describe, expect, it } from "vitest";
import {
  getAuthPublicConfig,
  getSupabaseRuntimeConfig,
} from "@/lib/auth/config";

const ORIGINAL_ENV = {
  NEXT_PUBLIC_AUTH_PROVIDERS: process.env.NEXT_PUBLIC_AUTH_PROVIDERS,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
};

describe("auth config", () => {
  afterEach(() => {
    process.env.NEXT_PUBLIC_AUTH_PROVIDERS = ORIGINAL_ENV.NEXT_PUBLIC_AUTH_PROVIDERS;
    process.env.NEXT_PUBLIC_SUPABASE_URL = ORIGINAL_ENV.NEXT_PUBLIC_SUPABASE_URL;
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY =
      ORIGINAL_ENV.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  });

  it("defaults to magic-link auth", () => {
    delete process.env.NEXT_PUBLIC_AUTH_PROVIDERS;

    expect(getAuthPublicConfig().enabledProviders).toEqual(["magic_link"]);
  });

  it("includes Google when explicitly enabled", () => {
    process.env.NEXT_PUBLIC_AUTH_PROVIDERS = "magic_link,google";

    expect(getAuthPublicConfig().enabledProviders).toEqual([
      "magic_link",
      "google",
    ]);
  });

  it("fails with a controlled error when Supabase env is missing", () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    expect(() => getSupabaseRuntimeConfig()).toThrow(
      /Supabase auth is not configured/i,
    );
  });
});
