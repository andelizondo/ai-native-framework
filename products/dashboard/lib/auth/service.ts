import { captureError, captureMessage } from "@/lib/monitoring";
import { AuthConfigError, isAuthProviderEnabled } from "./config";
import {
  requestMagicLinkWithSupabase,
  signInWithOAuthWithSupabase,
  signOutWithSupabase,
} from "./supabase-browser-adapter";
import type { AuthProvider, AuthResult, OAuthProvider } from "./types";

export { getAuthPublicConfig as getAuthConfig } from "./config";

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

function providerDisabledResult<T>(provider: AuthProvider): AuthResult<T> {
  return {
    ok: false,
    error: {
      code: "provider_not_enabled",
      message: `${provider} authentication is not enabled for this environment.`,
    },
  };
}

export async function requestMagicLink(
  email: string,
  redirectTo: string,
): Promise<AuthResult<{ provider: "magic_link" }>> {
  if (!isAuthProviderEnabled("magic_link")) {
    return providerDisabledResult("magic_link");
  }

  try {
    const { error } = await requestMagicLinkWithSupabase(email, redirectTo);

    if (error) {
      captureMessage("Magic link request failed", "warning", {
        feature: "auth.request_magic_link",
        extra: { reason: error.message },
      });

      return {
        ok: false,
        error: {
          code: "magic_link_request_failed",
          message: error.message,
        },
      };
    }

    return { ok: true, data: { provider: "magic_link" } };
  } catch (error) {
    if (error instanceof AuthConfigError) {
      return configErrorResult();
    }

    captureError(error, {
      feature: "auth.request_magic_link",
      action: "request_magic_link",
    });

    return {
      ok: false,
      error: {
        code: "magic_link_request_failed",
        message: "We could not send that magic link. Try again.",
      },
    };
  }
}

export async function signInWithOAuth(
  provider: OAuthProvider,
  redirectTo: string,
): Promise<AuthResult<{ provider: OAuthProvider }>> {
  if (!isAuthProviderEnabled(provider)) {
    return providerDisabledResult(provider);
  }

  try {
    const { error } = await signInWithOAuthWithSupabase(provider, redirectTo);

    if (error) {
      captureMessage("OAuth sign-in failed", "warning", {
        feature: "auth.sign_in_with_oauth",
        extra: { provider, reason: error.message },
      });

      return {
        ok: false,
        error: {
          code: "oauth_sign_in_failed",
          message: error.message,
        },
      };
    }

    return { ok: true, data: { provider } };
  } catch (error) {
    if (error instanceof AuthConfigError) {
      return configErrorResult();
    }

    captureError(error, {
      feature: "auth.sign_in_with_oauth",
      action: provider,
    });

    return {
      ok: false,
      error: {
        code: "oauth_sign_in_failed",
        message: "We could not start that sign-in flow. Try again.",
      },
    };
  }
}

export async function signOut(): Promise<AuthResult<{ success: true }>> {
  try {
    const { error } = await signOutWithSupabase();

    if (error) {
      captureMessage("Sign-out failed", "warning", {
        feature: "auth.sign_out",
        extra: { reason: error.message },
      });

      return {
        ok: false,
        error: {
          code: "sign_out_failed",
          message: error.message,
        },
      };
    }

    return { ok: true, data: { success: true } };
  } catch (error) {
    if (error instanceof AuthConfigError) {
      return configErrorResult();
    }

    captureError(error, {
      feature: "auth.sign_out",
      action: "sign_out",
    });

    return {
      ok: false,
      error: {
        code: "sign_out_failed",
        message: "We could not sign you out. Try again.",
      },
    };
  }
}
