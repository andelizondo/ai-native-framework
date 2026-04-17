import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { getSupabaseRuntimeConfig } from "./config";
import type { AuthUser, MiddlewareAuthState, MiddlewareContext } from "./types";

function mapUser(user: User | null): AuthUser | null {
  if (!user) {
    return null;
  }

  const provider = user.app_metadata?.provider === "google" ? "google" : "magic_link";

  return {
    id: user.id,
    email: user.email ?? null,
    provider,
  };
}

async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  const { url, anonKey } = getSupabaseRuntimeConfig();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Server Components cannot always write cookies; middleware handles refresh.
        }
      },
    },
  });
}

export async function exchangeCallbackWithSupabase(code: string) {
  const client = await createSupabaseServerClient();
  const { data, error } = await client.auth.exchangeCodeForSession(code);

  return {
    user: mapUser(data?.user ?? null),
    error,
  };
}

export async function getServerUserWithSupabase(): Promise<AuthUser | null> {
  const client = await createSupabaseServerClient();
  const { data } = await client.auth.getUser();

  return mapUser(data?.user ?? null);
}

export async function getMiddlewareUserWithSupabase({
  req,
  requestHeaders,
}: MiddlewareContext): Promise<MiddlewareAuthState> {
  const { url, anonKey } = getSupabaseRuntimeConfig();
  let response = NextResponse.next({ request: { headers: requestHeaders } });

  const client = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return req.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value));
        const nextHeaders = new Headers(requestHeaders);
        nextHeaders.set("cookie", req.cookies.toString());
        response = NextResponse.next({ request: { headers: nextHeaders } });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  const {
    data: { user },
  } = await client.auth.getUser();

  return {
    user: mapUser(user),
    response,
  };
}
