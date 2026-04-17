import { NextResponse } from "next/server";
import { captureError, captureMessage } from "@/lib/monitoring";
import { AuthConfigError } from "./config";
import {
  exchangeCallbackWithSupabase,
  getMiddlewareUserWithSupabase,
  getServerUserWithSupabase,
} from "./supabase-server-adapter";
import { getRequestBypassUser, getServerBypassUser } from "./test-bypass";
import type {
  AuthProvider,
  AuthResult,
  AuthUser,
  MiddlewareAuthState,
  MiddlewareContext,
} from "./types";

function configErrorResult<T>(): AuthResult<T> {
  return {
    ok: false,
    error: {
      code: "auth_not_configured",
      message:
        "Authentication is not configured for this environment. Set the Supabase runtime variables first.",
    },
  };
}

export async function exchangeCallback(
  url: string,
): Promise<AuthResult<{ user: AuthUser | null; provider: AuthProvider }>> {
  try {
    const parsedUrl = new URL(url);
    const code = parsedUrl.searchParams.get("code");
    const provider =
      parsedUrl.searchParams.get("provider") === "google"
        ? "google"
        : "magic_link";

    if (!code) {
      return {
        ok: false,
        error: {
          code: "callback_failed",
          message: "That sign-in link is invalid or missing a code.",
        },
      };
    }

    const { user, error } = await exchangeCallbackWithSupabase(code);

    if (error) {
      captureMessage("Auth callback exchange failed", "warning", {
        feature: "auth.callback",
        extra: { provider, reason: error.message },
      });

      return {
        ok: false,
        error: {
          code: "callback_failed",
          message: error.message,
        },
      };
    }

    return { ok: true, data: { user, provider } };
  } catch (error) {
    if (error instanceof AuthConfigError) {
      return configErrorResult();
    }

    captureError(error, {
      feature: "auth.callback",
      action: "exchange_callback",
    });

    return {
      ok: false,
      error: {
        code: "callback_failed",
        message: "We could not complete sign-in. Try again.",
      },
    };
  }
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const bypassUser = await getServerBypassUser();
  if (bypassUser) {
    return bypassUser;
  }

  return getServerUserWithSupabase();
}

export async function getCurrentUserForRequest(
  context: MiddlewareContext,
): Promise<MiddlewareAuthState> {
  const bypassUser = getRequestBypassUser(context.req);
  if (bypassUser) {
    return {
      user: bypassUser,
      response: NextResponse.next({
        request: { headers: context.requestHeaders },
      }),
    };
  }

  return getMiddlewareUserWithSupabase(context);
}
