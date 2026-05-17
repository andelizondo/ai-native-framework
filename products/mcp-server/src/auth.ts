/**
 * Resolves an incoming MCP session to a Supabase user_id.
 *
 * v1 strategy: dev-mode env var. The MCP server is invoked locally
 * by a single user (the Supabase project owner per DEC-002) via
 * Claude Desktop's mcpServers config, which sets MCP_USER_ID and
 * SUPABASE_SERVICE_ROLE_KEY in `env`. There is no per-request
 * credential — the *whole process* is bound to one user, and the
 * Claude Desktop config file is the trust boundary.
 *
 * Roadmap (not in this PR): PAT table + per-request validation,
 * then OAuth device-code flow.
 */

export interface ResolvedPrincipal {
  /** Supabase user_id this session acts as. */
  readonly userId: string;
  /** String written to event envelope `emitted_by`. */
  readonly emittedBy: string;
}

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}

export function resolvePrincipalFromEnv(): ResolvedPrincipal {
  const userId = process.env.MCP_USER_ID?.trim();
  if (!userId) {
    throw new AuthError(
      "MCP_USER_ID is not set. Configure it in your Claude Desktop mcpServers entry (env block).",
    );
  }
  return {
    userId,
    emittedBy: `mcp:${userId}`,
  };
}
