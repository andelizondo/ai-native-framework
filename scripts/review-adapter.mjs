#!/usr/bin/env node
/**
 * Provider-agnostic PR review adapter: produces JSON validated against
 * spec/schema/review-findings.schema.json for policy and CI consumption.
 */
import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { fileURLToPath } from "node:url";
import Ajv from "ajv";
import addFormats from "ajv-formats";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const schemaPath = path.join(root, "spec", "schema", "review-findings.schema.json");

const MAX_DIFF_CHARS = 200_000;

const { values: args } = parseArgs({
  options: {
    provider: { type: "string", default: "stub" },
    "diff-file": { type: "string" },
    "initial-risk": {
      type: "string",
      description: "Overrides P1_INITIAL_RISK (low | med | high)",
    },
    out: { type: "string" },
    instructions: {
      type: "string",
      default: path.join(root, ".github", "copilot-instructions.md"),
    },
    help: { type: "boolean", short: "h", default: false },
  },
  allowPositionals: false,
});

function usage() {
  console.error(`Usage: node scripts/review-adapter.mjs --diff-file <path> [--provider stub|anthropic] [--out findings.json] [--instructions path]

Environment (anthropic):
  ANTHROPIC_API_KEY   Required for --provider anthropic
  ANTHROPIC_MODEL     Optional, default claude-3-5-haiku-20241022

P1 initial risk (required for residual guardrails):
  P1_INITIAL_RISK     low | med | high  (medium accepted)
  --initial-risk      Same, overrides env for local runs

Optional PR context (from GitHub Actions or manual):
  GITHUB_EVENT_PATH   If set and contains pull_request, fills pull_request in output.
`);
}

if (args.help) {
  usage();
  process.exit(0);
}

if (!args["diff-file"]) {
  usage();
  console.error("Error: --diff-file is required.");
  process.exit(1);
}

const diffPath = path.resolve(args["diff-file"]);
if (!fs.existsSync(diffPath)) {
  console.error("Diff file not found:", diffPath);
  process.exit(1);
}

let diffText = fs.readFileSync(diffPath, "utf8");
let truncatedDiff = false;
if (diffText.length > MAX_DIFF_CHARS) {
  truncatedDiff = true;
  diffText =
    diffText.slice(0, MAX_DIFF_CHARS) +
    "\n\n[diff truncated by review-adapter for provider limits]\n";
}

let instructions = "";
const instrPath = path.resolve(args.instructions);
if (fs.existsSync(instrPath)) {
  instructions = fs.readFileSync(instrPath, "utf8");
}

function readPullRequestFromGithubEvent() {
  const p = process.env.GITHUB_EVENT_PATH;
  if (!p || !fs.existsSync(p)) return undefined;
  try {
    const ev = JSON.parse(fs.readFileSync(p, "utf8"));
    const pr = ev.pull_request;
    if (!pr) return undefined;
    return {
      number: pr.number,
      base_sha: pr.base?.sha,
      head_sha: pr.head?.sha,
      base_ref: pr.base?.ref,
      head_ref: pr.head?.ref,
    };
  } catch {
    return undefined;
  }
}

function stripJsonFence(text) {
  const fence = /^```(?:json)?\s*\n?([\s\S]*?)\n?```\s*$/m.exec(text.trim());
  if (fence) return fence[1].trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) return text.slice(start, end + 1);
  return text.trim();
}

function parseRiskToken(raw) {
  const v = (raw || "").trim().toLowerCase();
  if (v === "high") return "high";
  if (v === "medium" || v === "med") return "medium";
  if (v === "low") return "low";
  return null;
}

function resolveInitialRisk() {
  return (
    parseRiskToken(args["initial-risk"]) || parseRiskToken(process.env.P1_INITIAL_RISK)
  );
}

/**
 * Merge model suggestion with P1 guardrails. Initial risk is structural (paths);
 * residual is post-review authority.
 */
function resolveResidual(initial, doc, modelResidual) {
  const findings = doc.findings || [];
  const blocking = findings.filter((f) => f.blocking);
  const criticalBlocking = blocking.some((f) => f.severity === "critical");
  const modelLevel = modelResidual?.level;
  const modelRationale = (modelResidual?.rationale || "").trim();

  if (initial === "high") {
    return {
      level: "high",
      rationale:
        "P1 guardrail: initial risk is high; residual stays high until mandatory human review.",
    };
  }

  if (criticalBlocking) {
    const msgs = blocking
      .filter((f) => f.severity === "critical")
      .map((f) => f.message)
      .join("; ");
    return {
      level: "high",
      rationale: `Blocking critical finding(s): ${msgs}`,
    };
  }

  if (blocking.length > 0) {
    return {
      level: "med",
      rationale: `Blocking finding(s) present (${blocking.length}); human or follow-up required before merge automation.`,
    };
  }

  if (doc.truncated_diff) {
    return {
      level: "med",
      rationale:
        "Diff was truncated for the reviewer; conservative residual until full diff is reviewed.",
    };
  }

  if (initial === "medium") {
    if (doc.provider === "stub") {
      return {
        level: "med",
        rationale:
          "Stub reviewer (no LLM): medium initial risk without blocking findings; residual medium until a real review or human approval.",
      };
    }
    const wantsLow = modelLevel === "low";
    const confOk = doc.confidence === "high";
    if (wantsLow && confOk) {
      return {
        level: "low",
        rationale:
          modelRationale ||
          "No blocking findings; reviewer assessed residual low with high confidence.",
      };
    }
    if (modelLevel === "high") {
      return {
        level: "high",
        rationale: modelRationale || "Reviewer escalated residual to high.",
      };
    }
    return {
      level: "med",
      rationale:
        modelRationale ||
        "Medium initial risk; reviewer did not clear for automated low residual.",
    };
  }

  // initial low
  return {
    level: "low",
    rationale:
      modelRationale ||
      "Initial low risk and no blocking findings after automated review.",
  };
}

async function providerStub() {
  return {
    schema_version: "1.0.0",
    provider: "stub",
    generated_at: new Date().toISOString(),
    summary:
      "Stub provider: no LLM review ran. CI uses this by default; set ANTHROPIC_API_KEY and --provider anthropic for automated findings.",
    findings: [],
    confidence: "high",
    ...(truncatedDiff ? { truncated_diff: true } : {}),
  };
}

async function providerAnthropic(initialRiskLabel) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    console.error("ANTHROPIC_API_KEY is required for --provider anthropic");
    process.exit(1);
  }
  const model =
    process.env.ANTHROPIC_MODEL || "claude-3-5-haiku-20241022";

  const schemaHint = `Return ONLY a JSON object (no markdown) with this shape:
{
  "schema_version": "1.0.0",
  "provider": "anthropic",
  "generated_at": "<ISO-8601 now>",
  "summary": "<short overall assessment>",
  "findings": [
    {
      "severity": "critical" | "medium" | "minor" | "info",
      "blocking": true | false,
      "message": "<specific finding>",
      "path": "<optional repo-relative path>",
      "line": <optional positive integer>,
      "code": "<optional short id>"
    }
  ],
  "confidence": "low" | "medium" | "high",
  "residual_assessment": {
    "level": "low" | "med" | "high",
    "rationale": "<why this residual tier is appropriate given findings and initial risk>"
  }
}

Context: P1 **initial structural risk** for this PR (from path policy) is **${initialRiskLabel}**.
- If initial is **high**, you may still note findings but the pipeline will force residual **high** until a human reviews.
- Prefer **residual low** only when there are **no blocking findings** and you have **high** confidence the change is safe to merge under automation.
- Use **residual med** when uncertain or when the change warrants human eyes despite no hard blockers.
- Use **residual high** for material security, correctness, or policy risk.

Rules for findings:
- blocking true only for issues that should block merge without human override (security, correctness, spec violations).
- Use severity critical for security/data issues; medium for likely bugs; minor/info for style or nits.
- If the diff is fine, findings may be [].`;

  const userContent = [
    "You are a code reviewer for this repository. Follow repository instructions below.\n",
    "--- Repository instructions ---\n",
    instructions || "(none provided)\n",
    "---\n",
    schemaHint,
    "\n--- Diff ---\n",
    diffText,
  ].join("");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      messages: [{ role: "user", content: userContent }],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error("Anthropic API error:", res.status, errText);
    process.exit(1);
  }

  const data = await res.json();
  const textBlock = data.content?.find((b) => b.type === "text");
  if (!textBlock?.text) {
    console.error("Unexpected Anthropic response:", JSON.stringify(data));
    process.exit(1);
  }

  let parsed;
  try {
    parsed = JSON.parse(stripJsonFence(textBlock.text));
  } catch (e) {
    console.error("Failed to parse model JSON:", e.message);
    console.error("Raw:", textBlock.text.slice(0, 2000));
    process.exit(1);
  }

  parsed.schema_version = "1.0.0";
  parsed.provider = "anthropic";
  if (truncatedDiff) parsed.truncated_diff = true;
  return parsed;
}

async function main() {
  const initial = resolveInitialRisk();
  if (!initial) {
    console.error(
      "Set P1_INITIAL_RISK or --initial-risk to low | med | high (path-based initial risk for P1).",
    );
    process.exit(1);
  }
  const initialRiskLabel =
    initial === "medium" ? "medium (med)" : initial === "high" ? "high" : "low";

  const name = args.provider;
  if (name !== "stub" && name !== "anthropic") {
    console.error(`Unknown provider: ${name}. Choose: stub, anthropic`);
    process.exit(1);
  }

  const doc =
    name === "anthropic"
      ? await providerAnthropic(initialRiskLabel)
      : await providerStub();

  const modelResidual = doc.residual_assessment
    ? { ...doc.residual_assessment }
    : null;
  delete doc.residual_assessment;

  doc.residual_assessment = resolveResidual(initial, doc, modelResidual);

  const pr = readPullRequestFromGithubEvent();
  if (pr && pr.number != null) {
    doc.pull_request = {
      ...(doc.pull_request || {}),
      ...pr,
    };
  }

  if (!doc.generated_at) {
    doc.generated_at = new Date().toISOString();
  }

  const schema = JSON.parse(fs.readFileSync(schemaPath, "utf8"));
  if (schema.$schema) delete schema.$schema;
  const ajv = new Ajv({ allErrors: true, strict: true });
  addFormats(ajv);
  const validate = ajv.compile(schema);
  if (!validate(doc)) {
    console.error("Adapter output failed schema validation:", validate.errors);
    console.error("Document:", JSON.stringify(doc, null, 2));
    process.exit(1);
  }

  const json = JSON.stringify(doc, null, 2);
  if (args.out) {
    fs.writeFileSync(path.resolve(args.out), json, "utf8");
    console.log("Wrote", path.resolve(args.out));
  } else {
    console.log(json);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
