import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import type { AuthUser } from "./types";

export const AUTH_TEST_BYPASS_COOKIE = "dashboard_e2e_auth";

function decodeBypassValue(value: string): AuthUser | null {
  const secret = process.env.AUTH_E2E_BYPASS_SECRET;
  if (!secret || process.env.NODE_ENV === "production") {
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
