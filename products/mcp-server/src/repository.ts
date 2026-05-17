/**
 * Headless WorkflowRepository factory.
 *
 * The dashboard's `getServerWorkflowRepository` (lib/workflows/repository.server.ts)
 * is cookie-aware and Next-bound: RLS sees the signed-in browser session.
 * Here, the MCP server runs as a long-lived Node process with no cookies,
 * so we build the Supabase client from env vars and let the repository do
 * its own input validation. Per DEC-002, RLS allows any authenticated row
 * read/write, so a service-role client is acceptable for v1.
 *
 * When a per-company RLS policy lands, this factory will switch to a
 * scoped client constructed from the resolved principal's PAT.
 */

import { createClient } from "@supabase/supabase-js";

import { createWorkflowRepository } from "../../dashboard/lib/workflows/repository.ts";
import type { WorkflowRepository } from "../../dashboard/lib/workflows/types.ts";

type RepoClientArg = Parameters<typeof createWorkflowRepository>[0];

export class RepositoryConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RepositoryConfigError";
  }
}

let memoized: WorkflowRepository | null = null;

export function getRepository(): WorkflowRepository {
  if (memoized) return memoized;

  const url = process.env.SUPABASE_URL?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!url || !serviceKey) {
    throw new RepositoryConfigError(
      "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must both be set.",
    );
  }

  const client = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Cast bridges two nominally-identical SupabaseClient types that live in
  // separate node_modules trees (mcp-server's vs dashboard's). They are the
  // same package and same version; the cast collapses the nominal mismatch.
  memoized = createWorkflowRepository(client as unknown as RepoClientArg);
  return memoized;
}
