import type { NextRequest, NextResponse } from "next/server";

export type AuthProvider = "magic_link" | "google";

export type AuthUser = {
  id: string;
  email: string | null;
};

export type AuthErrorCode =
  | "auth_not_configured"
  | "provider_not_enabled"
  | "magic_link_request_failed"
  | "oauth_sign_in_failed"
  | "callback_failed"
  | "sign_out_failed";

export type AuthResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      error: {
        code: AuthErrorCode;
        message: string;
      };
    };

export type AuthProviderOption = {
  id: AuthProvider;
  label: string;
  enabled: boolean;
};

export type AuthPublicConfig = {
  enabledProviders: AuthProvider[];
  providers: AuthProviderOption[];
};

export type MiddlewareAuthState = {
  user: AuthUser | null;
  response: NextResponse;
};

export type MiddlewareContext = {
  req: NextRequest;
  requestHeaders: Headers;
};
