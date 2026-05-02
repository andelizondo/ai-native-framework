import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { getSupabaseRuntimeConfig } from "@/lib/auth/config";
import { getServerBypassSupabaseCookie } from "@/lib/auth/test-bypass";
import { createWorkflowRepository } from "./repository";
import type { WorkflowRepository } from "./types";

// Server-side factory. Uses the same cookie-aware Supabase client as the auth
// adapter so RLS policies see the signed-in user automatically (DEC-002).
//
// Note: this MUST only be imported from server components, route handlers, or
// server actions. The browser-side equivalent will live alongside the existing
// supabase-browser-adapter when the dashboard wires up client interactions.
export async function getServerWorkflowRepository(): Promise<WorkflowRepository> {
  const cookieStore = await cookies();
  const { url, anonKey } = getSupabaseRuntimeConfig();
  const bypassCookie = await getServerBypassSupabaseCookie();

  const client = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        const real = cookieStore.getAll();
        if (!bypassCookie) return real;
        const filtered = real.filter((c) => c.name !== bypassCookie.name);
        return [...filtered, bypassCookie];
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Server Components cannot always write cookies; auth middleware
          // refreshes the session on the next request.
        }
      },
    },
  });

  return createWorkflowRepository(client);
}
