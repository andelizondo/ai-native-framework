#!/usr/bin/env node
/**
 * Validates YAML/JSON instances under spec/examples against spec/schema/product-spec.schema.json
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Ajv from "ajv";
import addFormats from "ajv-formats";
import yaml from "js-yaml";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const schemaPath = path.join(root, "spec", "schema", "product-spec.schema.json");
const examplesDir = path.join(root, "spec", "examples");

const ajv = new Ajv({ allErrors: true, strict: true });
addFormats(ajv);

const schema = JSON.parse(fs.readFileSync(schemaPath, "utf8"));
// Avoid requiring network/meta fetch for "$schema" self-declaration
if (schema.$schema) delete schema.$schema;
const validate = ajv.compile(schema);

const files = fs
  .readdirSync(examplesDir)
  .filter((f) => f.endsWith(".yaml") || f.endsWith(".yml") || f.endsWith(".json"));

if (files.length === 0) {
  console.error("No example specs found in", examplesDir);
  process.exit(1);
}

let failed = false;
for (const file of files) {
  const full = path.join(examplesDir, file);
  const raw = fs.readFileSync(full, "utf8");
  const data = file.endsWith(".json") ? JSON.parse(raw) : yaml.load(raw);
  const ok = validate(data);
  if (!ok) {
    failed = true;
    console.error(`\nInvalid: ${file}`);
    console.error(validate.errors);
  } else {
    console.log(`OK: ${file}`);
  }
}

if (failed) process.exit(1);
console.log("\nAll example specs are valid.");
