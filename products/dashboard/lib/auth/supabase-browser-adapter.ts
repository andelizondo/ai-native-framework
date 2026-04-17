import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseRuntimeConfig } from "./config";
import type { OAuthProvider } from "./types";

function mapOAuthProvider(provider: OAuthProvider): "google" {
  return "google";
}

function createSupabaseBrowserClient() {
  const { url, anonKey } = getSupabaseRuntimeConfig();
  return createBrowserClient(url, anonKey);
}

export async function requestMagicLinkWithSupabase(
  email: string,
  redirectTo: string,
) {
  const client = createSupabaseBrowserClient();
  return client.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: redirectTo },
  });
}

export async function signInWithOAuthWithSupabase(
  provider: OAuthProvider,
  redirectTo: string,
) {
  const client = createSupabaseBrowserClient();
  return client.auth.signInWithOAuth({
    provider: mapOAuthProvider(provider),
    options: { redirectTo },
  });
}

export async function signOutWithSupabase() {
  const client = createSupabaseBrowserClient();
  return client.auth.signOut();
}
