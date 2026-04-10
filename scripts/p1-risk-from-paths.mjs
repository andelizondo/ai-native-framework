#!/usr/bin/env node
/**
 * P1 initial risk from changed paths (reads spec/policy/p1-path-risk.json).
 * Usage: node scripts/p1-risk-from-paths.mjs [paths-file]
 *        (stdin: newline-separated paths if no file)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const policyPath = path.join(root, "spec", "policy", "p1-path-risk.json");

function escapeRegex(value) {
  return value.replace(/[|\\{}()[\]^$+?.]/g, "\\$&");
}

function patternToRegExp(pattern) {
  let source = escapeRegex(pattern);
  source = source.replace(/\*\*/g, ".*");
  source = source.replace(/\*/g, "[^/]*");
  return new RegExp(`^${source}$`);
}

function matches(p, patterns) {
  return patterns.some((pattern) => patternToRegExp(pattern).test(p));
}

function riskFromPaths(paths, policy) {
  const { highRiskPatterns, protectedPatterns, lowRiskPatterns } = policy;
  let risk = "low";
  const reasons = [];

  for (const p of paths) {
    if (!p) continue;
    if (matches(p, highRiskPatterns)) {
      risk = "high";
      reasons.push(`${p} matches a high-risk protected surface.`);
      continue;
    }
    if (matches(p, protectedPatterns)) {
      if (risk !== "high") risk = "medium";
      reasons.push(`${p} matches a protected repository surface.`);
      continue;
    }
    if (!matches(p, lowRiskPatterns)) {
      if (risk === "low") risk = "medium";
      reasons.push(`${p} does not match the low-risk path allowlist.`);
    }
  }

  return {
    risk,
    reasons: [...new Set(reasons)],
  };
}

function readPaths() {
  const file = process.argv[2];
  const raw = file
    ? fs.readFileSync(path.resolve(file), "utf8")
    : fs.readFileSync(0, "utf8");
  return raw
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

const policy = JSON.parse(fs.readFileSync(policyPath, "utf8"));
const paths = readPaths();
const result = riskFromPaths(paths, policy);
process.stdout.write(JSON.stringify(result));
