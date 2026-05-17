/**
 * Propose/confirm protocol for `confirm_required` tools.
 *
 * Flow: an agent calls `propose_<tool>(args)`. We return a signed,
 * single-use token plus a human-readable diff for the agent to show
 * the user. The user approves; the agent calls `confirm_<tool>(token)`
 * and we re-derive (tool, args) from the token and execute.
 *
 * Token shape (base64url-encoded JSON of payload || hex HMAC):
 *   payload = { principal, tool, argsJson, expiresAt }
 * Secret comes from MCP_PROPOSAL_SECRET (env). Tokens expire in
 * PROPOSAL_TTL_MS milliseconds and are single-use within process
 * memory.
 */

import crypto from "node:crypto";

const PROPOSAL_TTL_MS = 5 * 60 * 1000; // 5 minutes
const TOKEN_SEP = ".";

export class ProposalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProposalError";
  }
}

interface ProposalPayload {
  principal: string;
  tool: string;
  argsJson: string;
  expiresAt: number;
}

export interface DecodedProposal {
  principal: string;
  tool: string;
  args: unknown;
}

const usedTokens = new Set<string>();

function getSecret(): string {
  const s = process.env.MCP_PROPOSAL_SECRET?.trim();
  if (!s || s.length < 16) {
    throw new ProposalError(
      "MCP_PROPOSAL_SECRET must be set (>= 16 chars) for the propose/confirm flow.",
    );
  }
  return s;
}

function sign(value: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(value).digest("hex");
}

function b64urlEncode(input: string): string {
  return Buffer.from(input, "utf8")
    .toString("base64")
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}

function b64urlDecode(input: string): string {
  const padded = input.replaceAll("-", "+").replaceAll("_", "/");
  return Buffer.from(padded, "base64").toString("utf8");
}

export function issueProposal(
  principal: string,
  tool: string,
  args: unknown,
): { token: string; expiresAt: string } {
  const secret = getSecret();
  const payload: ProposalPayload = {
    principal,
    tool,
    argsJson: JSON.stringify(args ?? {}),
    expiresAt: Date.now() + PROPOSAL_TTL_MS,
  };
  const body = b64urlEncode(JSON.stringify(payload));
  const mac = sign(body, secret);
  return {
    token: `${body}${TOKEN_SEP}${mac}`,
    expiresAt: new Date(payload.expiresAt).toISOString(),
  };
}

export function consumeProposal(token: string): DecodedProposal {
  if (typeof token !== "string" || !token.includes(TOKEN_SEP)) {
    throw new ProposalError("Malformed proposal token.");
  }
  if (usedTokens.has(token)) {
    throw new ProposalError("Proposal token already used.");
  }
  const secret = getSecret();
  const [body, mac] = token.split(TOKEN_SEP);
  const expected = sign(body, secret);
  if (
    mac.length !== expected.length ||
    !crypto.timingSafeEqual(Buffer.from(mac, "hex"), Buffer.from(expected, "hex"))
  ) {
    throw new ProposalError("Proposal token signature mismatch.");
  }

  let payload: ProposalPayload;
  try {
    payload = JSON.parse(b64urlDecode(body)) as ProposalPayload;
  } catch {
    throw new ProposalError("Proposal token payload is not valid JSON.");
  }

  if (typeof payload.expiresAt !== "number" || Date.now() > payload.expiresAt) {
    throw new ProposalError("Proposal token expired.");
  }

  let args: unknown;
  try {
    args = JSON.parse(payload.argsJson);
  } catch {
    throw new ProposalError("Proposal token args are not valid JSON.");
  }

  usedTokens.add(token);
  return { principal: payload.principal, tool: payload.tool, args };
}

export function describeProposal(tool: string, args: unknown): string {
  // Plain, readable diff for the agent to show the user. Deliberately
  // simple: just the tool name and its arguments. The agent client can
  // format this further before presenting.
  return [
    `Action: ${tool}`,
    "Arguments:",
    JSON.stringify(args ?? {}, null, 2),
  ].join("\n");
}
