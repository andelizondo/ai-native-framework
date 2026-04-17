import type { AuthProvider, AuthPublicConfig } from "./types";

const ALL_PROVIDERS: AuthProvider[] = ["magic_link", "google"];
const DEFAULT_PROVIDERS: AuthProvider[] = ["magic_link"];

export class AuthConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthConfigError";
  }
}

function parseEnabledProviders(raw: string | undefined): AuthProvider[] {
  if (!raw) {
    return DEFAULT_PROVIDERS;
  }

  const providers = raw
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter((value): value is AuthProvider =>
      ALL_PROVIDERS.includes(value as AuthProvider),
    );

  return providers.length > 0 ? providers : DEFAULT_PROVIDERS;
}

export function getEnabledAuthProviders(): AuthProvider[] {
  return parseEnabledProviders(process.env.NEXT_PUBLIC_AUTH_PROVIDERS);
}

export function isAuthProviderEnabled(provider: AuthProvider): boolean {
  return getEnabledAuthProviders().includes(provider);
}

export function getAuthPublicConfig(): AuthPublicConfig {
  const enabledProviders = getEnabledAuthProviders();

  return {
    enabledProviders,
    providers: [
      {
        id: "magic_link",
        label: "Magic link",
        enabled: enabledProviders.includes("magic_link"),
      },
      {
        id: "google",
        label: "Google",
        enabled: enabledProviders.includes("google"),
      },
    ],
  };
}

export function getSupabaseRuntimeConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new AuthConfigError(
      "Supabase auth is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }

  return { url, anonKey };
}
