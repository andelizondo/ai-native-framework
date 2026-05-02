import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import type { AuthUser } from "./types";

export const AUTH_TEST_BYPASS_COOKIE = "dashboard_e2e_auth";

/**
 * Bypass is never allowed on the production deployment. Preview uses
 * NODE_ENV=production like production, so we must not key only on NODE_ENV.
 * Local `next start` has NODE_ENV=production without VERCEL — keep that locked.
 */
function isAuthE2eBypassDisabled(): boolean {
  if (process.env.VERCEL_ENV === "production") {
    return true;
  }
  if (!process.env.VERCEL && process.env.NODE_ENV === "production") {
    return true;
  }
  return false;
}

function decodeBypassValue(value: string): AuthUser | null {
  const secret = process.env.AUTH_E2E_BYPASS_SECRET;
  if (!secret || isAuthE2eBypassDisabled()) {
    return null;
  }

  const [providedSecret, userId, encodedEmail] = value.split(":", 3);
  if (providedSecret !== secret || !userId) {
    return null;
  }

  return {
    id: userId,
    email: encodedEmail ? decodeURIComponent(encodedEmail) : null,
    provider: "magic_link",
  };
}

export async function getServerBypassUser(): Promise<AuthUser | null> {
  const cookieStore = await cookies();
  const value = cookieStore.get(AUTH_TEST_BYPASS_COOKIE)?.value;
  return value ? decodeBypassValue(value) : null;
}

export function getRequestBypassUser(req: NextRequest): AuthUser | null {
  const value = req.cookies.get(AUTH_TEST_BYPASS_COOKIE)?.value;
  return value ? decodeBypassValue(value) : null;
}

// Local/E2E only: when paired with a valid bypass cookie, mint a real Supabase
// session via the admin API and overlay it as the `sb-<project-ref>-auth-token`
// cookie so RLS-protected DB calls succeed as the bypass user. Sessions are
// cached in module memory and refreshed automatically before expiry.
//
// Requires `SUPABASE_SERVICE_ROLE_KEY` in the server environment. NEVER expose
// the service role key to the client. The bypass-cookie identity check still
// runs first, so a leaked service-role key alone won't grant access without a
// matching `dashboard_e2e_auth` cookie.
import { createClient } from "@supabase/supabase-js";

type BypassCookieRecord = { name: string; value: string };
type CachedSession = { cookieValue: string; expiresAtSec: number };

const sessionCache = new Map<string, CachedSession>();
const REFRESH_BEFORE_EXPIRY_SEC = 300; // refresh when <5 min remaining

function getSupabaseProjectRef(): string | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return null;
  return url.match(/https?:\/\/([^.]+)\.supabase\.co/)?.[1] ?? null;
}

async function mintBypassSessionCookie(
  userId: string,
  email: string,
): Promise<string | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRole) return null;

  const admin = createClient(url, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Generate a one-time magic-link OTP, then exchange it for a real session.
  // The user must already exist (they signed in via Google at least once).
  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (linkErr || !linkData?.properties?.email_otp) return null;

  const { data: sessionData, error: verifyErr } = await admin.auth.verifyOtp({
    email,
    token: linkData.properties.email_otp,
    type: "magiclink",
  });
  if (verifyErr || !sessionData?.session) return null;

  const s = sessionData.session;
  const payload = {
    access_token: s.access_token,
    token_type: s.token_type,
    expires_in: s.expires_in,
    expires_at: s.expires_at,
    refresh_token: s.refresh_token,
    user: s.user,
  };
  const cookieValue =
    "base64-" + Buffer.from(JSON.stringify(payload)).toString("base64");
  const expiresAtSec = s.expires_at ?? Math.floor(Date.now() / 1000) + 3600;

  sessionCache.set(userId, { cookieValue, expiresAtSec });
  return cookieValue;
}

async function bypassSupabaseCookie(
  bypassCookieValue: string | undefined,
): Promise<BypassCookieRecord | null> {
  if (!bypassCookieValue) return null;
  const user = decodeBypassValue(bypassCookieValue);
  if (!user || !user.email) return null;
  const ref = getSupabaseProjectRef();
  if (!ref) return null;

  const cached = sessionCache.get(user.id);
  const nowSec = Math.floor(Date.now() / 1000);
  if (cached && cached.expiresAtSec - REFRESH_BEFORE_EXPIRY_SEC > nowSec) {
    return { name: `sb-${ref}-auth-token`, value: cached.cookieValue };
  }

  const minted = await mintBypassSessionCookie(user.id, user.email);
  if (!minted) return cached ? { name: `sb-${ref}-auth-token`, value: cached.cookieValue } : null;
  return { name: `sb-${ref}-auth-token`, value: minted };
}

export async function getServerBypassSupabaseCookie(): Promise<BypassCookieRecord | null> {
  const cookieStore = await cookies();
  return bypassSupabaseCookie(cookieStore.get(AUTH_TEST_BYPASS_COOKIE)?.value);
}

export async function getRequestBypassSupabaseCookie(
  req: NextRequest,
): Promise<BypassCookieRecord | null> {
  return bypassSupabaseCookie(req.cookies.get(AUTH_TEST_BYPASS_COOKIE)?.value);
}
