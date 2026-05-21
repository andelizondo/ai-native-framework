/**
 * Smoke tests for the MCP server. These do not boot a real stdio
 * transport or hit Supabase; they validate the static invariants
 * between codegen, handler dispatch, and exposure-category gating.
 */

import { describe, expect, it } from "vitest";

import { GENERATED_TOOLS } from "../generated/tools.ts";
import { HANDLERS } from "../handlers.ts";
import {
  consumeProposal,
  issueProposal,
  ProposalError,
} from "../proposals.ts";

describe("generated tools ↔ handlers", () => {
  it("every generated tool has a handler", () => {
    const missing = GENERATED_TOOLS.filter(
      (t) => !(t.operation in HANDLERS),
    );
    expect(missing).toEqual([]);
  });

  it("no handler exists without a corresponding generated tool", () => {
    const opNames = new Set(GENERATED_TOOLS.map((t) => t.operation));
    const orphans = Object.keys(HANDLERS).filter((op) => !opNames.has(op));
    expect(orphans).toEqual([]);
  });

  it("tool names are unique", () => {
    const seen = new Set<string>();
    for (const t of GENERATED_TOOLS) {
      expect(seen.has(t.name)).toBe(false);
      seen.add(t.name);
    }
  });

  it("every non-ui_only category is one of the two expected values", () => {
    for (const t of GENERATED_TOOLS) {
      expect(["agent_safe", "confirm_required"]).toContain(t.category);
    }
  });
});

describe("proposal tokens", () => {
  const originalSecret = process.env.MCP_PROPOSAL_SECRET;
  process.env.MCP_PROPOSAL_SECRET = "test-secret-at-least-sixteen-chars";

  it("round-trips signed payloads", () => {
    const { token } = issueProposal("mcp:user-1", "workflows.create_instance", {
      template_id: "tpl-1",
      label: "Acme rollout",
    });
    const decoded = consumeProposal(token);
    expect(decoded.principal).toBe("mcp:user-1");
    expect(decoded.tool).toBe("workflows.create_instance");
    expect(decoded.args).toEqual({
      template_id: "tpl-1",
      label: "Acme rollout",
    });
  });

  it("rejects reuse", () => {
    const { token } = issueProposal("mcp:user-1", "workflows.delete_instance", {
      instance_id: "inst-1",
    });
    consumeProposal(token);
    expect(() => consumeProposal(token)).toThrow(ProposalError);
  });

  it("rejects tampered signatures", () => {
    const { token } = issueProposal("mcp:user-1", "workflows.create_template", {
      label: "X",
    });
    const tampered = `${token.split(".")[0]}.${"f".repeat(64)}`;
    expect(() => consumeProposal(tampered)).toThrow(ProposalError);
  });

  if (originalSecret !== undefined) {
    process.env.MCP_PROPOSAL_SECRET = originalSecret;
  }
});
