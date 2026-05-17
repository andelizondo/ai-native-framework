#!/usr/bin/env node
/**
 * Bundle the MCP server into a single self-contained ESM file.
 *
 * Output: dist/server.mjs (runnable with `node`).
 *
 * Why a bundle: macOS Claude Desktop is sandboxed and cannot read
 * files in an iCloud-synced Documents folder even with the
 * "Documents" privacy toggle on. Bundling lets us drop a single
 * file outside iCloud (see install-claude-desktop.mjs).
 */

import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

await build({
  entryPoints: [path.join(__dirname, "src", "index.ts")],
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node18",
  outfile: path.join(__dirname, "dist", "server.mjs"),
  sourcemap: "inline",
  logLevel: "info",
  // Node built-ins must stay external; everything else (including the
  // dashboard's WorkflowRepository implementation reached via relative
  // imports) is inlined into the bundle.
  packages: "bundle",
  banner: {
    js: "// AUTO-GENERATED bundle. Source: products/mcp-server/. Rebuild with `npm run build`.",
  },
});

console.log("✓ bundled to dist/server.mjs");
