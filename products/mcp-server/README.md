# `@ai-native-framework/mcp-server`

MCP (Model Context Protocol) adapter for the AI-native framework dashboard.

This is the runtime side of the agent integration surface described in [docs/AGENT_INTEGRATION.md](../../docs/AGENT_INTEGRATION.md). It exposes a curated subset of the `workflow_repository` operations from [interfaces/interfaces.yaml](../../interfaces/interfaces.yaml) to third-party agent clients (Claude Desktop, Cursor, custom).

## How it stays in sync with `interfaces.yaml`

Tool definitions are **generated**, not hand-maintained. `npm run generate` reads `interfaces/interfaces.yaml`, finds every operation with a non-`ui_only` `agent_exposure` block, and emits `src/generated/tools.ts`. If a tool name collides, or a non-`ui_only` op is missing a `tool_name`, the script exits non-zero so CI catches it.

For each generated tool:
- `agent_safe` operations are registered as a single MCP tool with the operation's input schema.
- `confirm_required` operations are split into two MCP tools: `propose.<name>` returns a signed token + human diff (no mutation), `confirm.<name>` takes the token and executes. The agent is expected to show the diff to the human before calling confirm.

Add a new operation? Edit `interfaces.yaml`, run `npm run generate`, add a matching entry to `src/handlers.ts`. The smoke test (`npm test`) asserts the two sides agree.

## Setup (Claude Desktop)

`~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "ai-native-framework": {
      "command": "tsx",
      "args": [
        "/absolute/path/to/ai-native-framework/products/mcp-server/src/index.ts"
      ],
      "env": {
        "SUPABASE_URL": "https://<project>.supabase.co",
        "SUPABASE_SERVICE_ROLE_KEY": "<service-role-key>",
        "MCP_USER_ID": "<your supabase user uuid>",
        "MCP_PROPOSAL_SECRET": "<>= 16 char secret used to sign proposal tokens>"
      }
    }
  }
}
```

The whole process is bound to one user. The Claude Desktop config file is the trust boundary; do not check it in.

## Local development

```bash
cd products/mcp-server
npm install
npm run generate      # codegen tools.ts
npm test              # smoke tests
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... MCP_USER_ID=... MCP_PROPOSAL_SECRET=test-secret-at-least-sixteen-chars npm start
```

The server speaks stdio MCP; talking to it interactively requires an MCP client. The unit tests (`npm test`) cover the static contract without booting the transport.

## Layout

| Path | Role |
|---|---|
| `src/index.ts` | MCP server entrypoint; stdio transport; tool registration |
| `src/handlers.ts` | Dispatch table: operation name → repository call |
| `src/repository.ts` | Headless Supabase + `WorkflowRepository` factory |
| `src/auth.ts` | Resolve current principal (env-based for v1) |
| `src/proposals.ts` | HMAC-signed propose/confirm tokens |
| `src/generated/tools.ts` | Generated from `interfaces.yaml`; committed |
| `src/__tests__/` | Smoke tests |

## Out of scope (v1)

- Per-request PAT validation. Process-bound auth via env vars is the v1 contract.
- Streaming / subscriptions. Agents poll via `workflows.list_instances` and friends.
- Per-tool rate limiting. Defer until first real workload.

See [docs/AGENT_INTEGRATION.md](../../docs/AGENT_INTEGRATION.md) for the broader design.
