/**
 * MCP server entrypoint.
 *
 * Reads the generated tool registry (driven by interfaces.yaml),
 * registers each tool with the MCP SDK, and dispatches calls to the
 * handler map. `confirm_required` tools are split into two tools:
 * `propose.<tool>` returns a signed token + human-readable diff;
 * `confirm.<tool>` consumes the token and executes via the same
 * handler. This realizes the propose/confirm protocol documented in
 * docs/AGENT_INTEGRATION.md.
 *
 * Transport: stdio. Invoke from Claude Desktop via mcpServers config:
 *   {
 *     "ai-native-framework": {
 *       "command": "tsx",
 *       "args": ["/path/to/products/mcp-server/src/index.ts"],
 *       "env": {
 *         "SUPABASE_URL": "...",
 *         "SUPABASE_SERVICE_ROLE_KEY": "...",
 *         "MCP_USER_ID": "...",
 *         "MCP_PROPOSAL_SECRET": "..."
 *       }
 *     }
 *   }
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { resolvePrincipalFromEnv } from "./auth.ts";
import { GENERATED_TOOLS } from "./generated/tools.ts";
import { HANDLERS } from "./handlers.ts";
import {
  consumeProposal,
  describeProposal,
  issueProposal,
  ProposalError,
} from "./proposals.ts";
import { getRepository } from "./repository.ts";

interface ExposedTool {
  /** MCP tool name shown to the client. */
  readonly name: string;
  /** Description shown to the client. */
  readonly description: string;
  readonly inputSchema: Readonly<Record<string, unknown>>;
  /** What this tool does when invoked. */
  readonly kind: "direct" | "propose" | "confirm";
  /** The underlying operation in interfaces.yaml. */
  readonly operation: string;
}

const PROPOSE_PREFIX = "propose.";
const CONFIRM_PREFIX = "confirm.";

function buildExposedTools(): ExposedTool[] {
  const out: ExposedTool[] = [];
  for (const t of GENERATED_TOOLS) {
    if (t.category === "agent_safe") {
      out.push({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema,
        kind: "direct",
        operation: t.operation,
      });
      continue;
    }
    // confirm_required: split into propose + confirm pair.
    out.push({
      name: `${PROPOSE_PREFIX}${t.name}`,
      description: `Propose ${t.name}. Returns a proposal_token plus a human-readable diff for the user to review. Does NOT mutate. Call confirm.${t.name} with the returned token to commit. Original op: ${t.description}`,
      inputSchema: t.inputSchema,
      kind: "propose",
      operation: t.operation,
    });
    out.push({
      name: `${CONFIRM_PREFIX}${t.name}`,
      description: `Confirm and execute a previously proposed ${t.name}. Pass the proposal_token returned by propose.${t.name}.`,
      inputSchema: {
        type: "object",
        properties: {
          proposal_token: { type: "string" },
        },
        required: ["proposal_token"],
        additionalProperties: false,
      },
      kind: "confirm",
      operation: t.operation,
    });
  }
  return out;
}

const TOOLS = buildExposedTools();
const TOOLS_BY_NAME = new Map<string, ExposedTool>(
  TOOLS.map((t) => [t.name, t]),
);

async function dispatch(operation: string, args: Record<string, unknown>) {
  const handler = HANDLERS[operation];
  if (!handler) {
    throw new Error(
      `No handler registered for operation "${operation}". ` +
        "Add an entry in src/handlers.ts or remove the agent_exposure block from interfaces.yaml.",
    );
  }
  const repo = getRepository();
  const principal = resolvePrincipalFromEnv();
  return handler({ repo, principal }, args);
}

function asJsonContent(value: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(value, null, 2),
      },
    ],
  };
}

async function handleToolCall(
  name: string,
  rawArgs: unknown,
): Promise<ReturnType<typeof asJsonContent>> {
  const tool = TOOLS_BY_NAME.get(name);
  if (!tool) throw new Error(`Unknown tool: ${name}`);
  const args = (rawArgs ?? {}) as Record<string, unknown>;

  if (tool.kind === "direct") {
    const result = await dispatch(tool.operation, args);
    return asJsonContent(result);
  }

  if (tool.kind === "propose") {
    const principal = resolvePrincipalFromEnv();
    const { token, expiresAt } = issueProposal(
      principal.emittedBy,
      tool.name.slice(PROPOSE_PREFIX.length),
      args,
    );
    return asJsonContent({
      proposal_token: token,
      expires_at: expiresAt,
      human_diff: describeProposal(
        tool.name.slice(PROPOSE_PREFIX.length),
        args,
      ),
    });
  }

  // confirm
  const token = typeof args["proposal_token"] === "string"
    ? (args["proposal_token"] as string)
    : "";
  if (!token) throw new ProposalError("proposal_token is required.");
  const decoded = consumeProposal(token);
  const principal = resolvePrincipalFromEnv();
  if (decoded.principal !== principal.emittedBy) {
    throw new ProposalError("Proposal token does not match current principal.");
  }
  const expectedToolBase = tool.name.slice(CONFIRM_PREFIX.length);
  if (decoded.tool !== expectedToolBase) {
    throw new ProposalError(
      `Proposal token is for "${decoded.tool}", not "${expectedToolBase}".`,
    );
  }
  const result = await dispatch(
    tool.operation,
    (decoded.args ?? {}) as Record<string, unknown>,
  );
  return asJsonContent(result);
}

async function main() {
  const server = new Server(
    {
      name: "ai-native-framework",
      version: "0.1.0",
    },
    {
      capabilities: {
        tools: {},
      },
    },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOLS.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    try {
      return await handleToolCall(req.params.name, req.params.arguments);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        isError: true,
        content: [{ type: "text" as const, text: message }],
      };
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
