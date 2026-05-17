#!/usr/bin/env node
/**
 * Install the bundled MCP server to a path outside iCloud-synced
 * Documents (sandbox-friendly for Claude Desktop on macOS).
 *
 * Copies dist/server.mjs to:
 *   ~/Library/Application Support/ai-native-framework-mcp/server.mjs
 *
 * Run via: npm run install:claude-desktop
 * (Implies a fresh build first.)
 *
 * After install, update claude_desktop_config.json so that
 * mcpServers["ai-native-framework"] points its `command` at
 * `/usr/bin/env` or your node binary and `args` at the installed
 * path. The README documents the exact entry.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const source = path.join(__dirname, "dist", "server.mjs");
if (!fs.existsSync(source)) {
  console.error(`Source bundle not found: ${source}`);
  console.error("Run `npm run build` first.");
  process.exit(1);
}

const installDir = path.join(
  os.homedir(),
  "Library",
  "Application Support",
  "ai-native-framework-mcp",
);
const target = path.join(installDir, "server.mjs");

fs.mkdirSync(installDir, { recursive: true });
fs.copyFileSync(source, target);
fs.chmodSync(target, 0o755);

console.log(`✓ installed to ${target}`);
console.log("");
console.log("claude_desktop_config.json entry:");
console.log(
  JSON.stringify(
    {
      "ai-native-framework": {
        command: process.execPath,
        args: [target],
        env: {
          SUPABASE_URL: "<your supabase project url>",
          SUPABASE_SERVICE_ROLE_KEY: "<your service-role key>",
          MCP_USER_ID: "<your auth.users uuid>",
          MCP_PROPOSAL_SECRET: "<>=16 char secret>",
        },
      },
    },
    null,
    2,
  ),
);
