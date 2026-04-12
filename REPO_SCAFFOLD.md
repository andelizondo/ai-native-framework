# Repository scaffold (materialize these files)

**How to use:** create each path under this repo root and paste the corresponding fenced block (without the outer `file` tag line inside the fence). In **Agent mode**, ask Cursor to “materialize all files from REPO_SCAFFOLD.md”.

---

## File: `.gitignore`

```
node_modules/
.DS_Store
*.log
.env
.env.*
```

---

## File: `AGENTS.md`

```md
# AGENTS.md

## Purpose

[One paragraph: what this repository is for and why agents operate here.]

Keep this file at the repository root as the primary entry point for agent tools; place other agent artifacts under `ai/` (see framework canonical repo).

## Read Order

1. `README.md`
2. [Primary framework or architecture doc]
3. `ai/PLAYBOOKS.md` (or your playbook index path)
4. [Task-specific playbooks under `ai/playbooks/` or specs]
5. `ai/SKILLS.md`
6. Only the specific `ai/skills/*.md` files selected from `ai/SKILLS.md`
7. `ai/MEMORY.md`

## Authority Ladder

1. [Machine-validated schema]
2. [Validated instances]
3. [Policy files]
4. [Interface contracts]
5. `ai/playbooks/*.md` (procedure bodies)
6. [Explanatory docs, e.g. `docs/*`]
7. `AGENTS.md`, `ai/PLAYBOOKS.md`, `ai/SKILLS.md`, `ai/skills/*.md`, `ai/MEMORY.md`

## Canonical Commands

- Install: `[install command]`
- Validate: `[validation command]`
- Test: `[test command if distinct]`

## Working Rules

- [Rule]
- [Rule]
- [Rule]

## Change Discipline

- When adding a new recurring workflow, update `ai/PLAYBOOKS.md`, `ai/playbooks/` as needed, and `ai/SKILLS.md`.
- When changing repo operating rules, check whether `AGENTS.md` and `ai/MEMORY.md` now need updates.
- When introducing durable process knowledge, prefer a playbook under `ai/playbooks/` or a schema-backed artifact over burying it in memory.

## Escalation Conditions

- [Condition]
- [Condition]
- [Condition]

## Important Paths

- `[path]` - [purpose]
- `[path]` - [purpose]
- `[path]` - [purpose]

## Definition Of Done

A framework change is not complete if it leaves the agent bundle under `ai/` stale. If your edit changes how an agent should bootstrap, choose a skill or playbook, validate work, or preserve context, update `AGENTS.md`, `ai/PLAYBOOKS.md`, `ai/SKILLS.md`, `ai/skills/`, `ai/playbooks/`, or `ai/MEMORY.md` in the same change as appropriate.
```

---

## File: `ai/SKILLS.md`

```md
# SKILLS.md

## How To Use This File

1. Match the task to the closest skill.
2. Read the linked canonical source.
3. Follow the listed constraints.

## Skill Registry

### [Skill Name]

- **When to use:** [trigger]
- **Inputs:** [inputs]
- **Outputs:** [outputs]
- **Canonical source:** [path]
- **Constraints:** [constraints]

### [Skill Name]

- **When to use:** [trigger]
- **Inputs:** [inputs]
- **Outputs:** [outputs]
- **Canonical source:** [path]
- **Constraints:** [constraints]
```

---

## File: `ai/MEMORY.md`

```md
# MEMORY.md

## Stable Facts

- [Fact]
- [Fact]

## Current State

- [Current durable state]

## Active Open Loops

- [Open loop]
- [Open loop]

## Recent Decisions

- [YYYY-MM-DD]: [Decision]

## Update Rules

- Add only durable facts.
- Remove stale entries.
- Move normative policy into canonical docs.
```

---

## File: `package.json`

```json
{
  "name": "ai-native-framework",
  "private": true,
  "type": "module",
  "description": "Agent-native product spec schemas, policies, and validation (canonical source: spec/)",
  "scripts": {
    "validate": "node scripts/validate-spec.mjs"
  },
  "devDependencies": {
    "ajv": "^8.17.1",
    "ajv-formats": "^3.0.1",
    "js-yaml": "^4.1.0"
  }
}
```

---

## File: `scripts/validate-spec.mjs`

```javascript
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
```

---

## File: `spec/schema/product-spec.schema.json`

See **Appendix A** below (large JSON Schema).

---

## File: `spec/policy/event-taxonomy.yaml`

```yaml
# Machine-readable event policy. Agents MUST follow this for new events.
version: "1.0.0"
updated_at: "2026-04-09"

naming:
  pattern: "domain.action_past_tense"
  examples:
    - "auth.user_signed_up"
    - "billing.invoice_paid"
  rules:
    - "Use snake_case segments; past-tense verb phrase as the final segment."
    - "Names are stable forever; never rename—deprecate and add a successor event."

payloads:
  rules:
    - "Payloads are JSON-serializable objects; avoid polymorphic one-of blobs when possible."
    - "Include correlation_id at the envelope level (see transport), not duplicated per field."
    - "Version the payload shape inside the catalog entry (schema_version)."

classification:
  pii_levels:
    - none
    - low
    - high
  idempotency:
    - none
    - recommended
    - required
  ordering:
    - at_least_once
    - effectively_exactly_once

transport:
  # Where events cross boundaries (product-specific). Agents should emit consistently.
  required_envelope_fields:
    - event_name
    - occurred_at
    - emitted_by
    - correlation_id
    - schema_version

deprecation:
  rules:
    - "Mark event as deprecated in catalog with replacement_event and sunset_date."
    - "Keep old events in analytics with a migration mapping document."

redaction:
  rules:
    - "For high PII events, document redaction rules for logs and third-party exports."
```

---

## File: `spec/examples/golden-product.yaml`

```yaml
spec_version: "1.0.0"
kind: product
product_id: "golden_demo"

metadata:
  title: "Golden Demo Product"
  status: draft
  owner: "platform@example.com"
  created_at: "2026-04-09T00:00:00Z"
  updated_at: "2026-04-09T00:00:00Z"
  tags:
    - "demo"
    - "framework"

ideation:
  problem: "Teams lose durable context between AI sessions and shipping iterations."
  user: "Small product teams using AI coding agents."
  goal: "Ship vertical slices with validated specs, events, and observability hooks."
  constraints:
    - "Minimize stack and vendor lock-in at the framework layer."
    - "Provider-agnostic agent interfaces."
  success_metrics:
    - name: "time_to_second_slice"
      definition: "Calendar days from first slice shipped to second slice shipped."
      target: "<= 7d"
  risks:
    - description: "Spec theater (pretty docs, invalid machine specs)"
      mitigation: "Schema CI on every change."

design:
  objective: "Provide a canonical, machine-verified product specification system."
  requirements:
    - id: "FR-001"
      priority: must
      statement: "All products MUST have a validated spec instance checked into VCS."
    - id: "FR-002"
      priority: must
      statement: "All externally meaningful actions SHOULD emit structured events."
  system_design: |
    Client -> API -> Postgres (Supabase) -> workers -> analytics (PostHog) / errors (Sentry).
    Specs live in-repo; runtime reads feature flags and typed config—not freeform prompts.
  tooling_decisions:
    - decision: "JSON Schema for spec validation"
      reason: "Wide tooling support; agents can generate and validate reliably."
      alternatives_considered:
        - "Protobuf"
        - "Custom DSL"
  assumptions:
    - text: "One primary Postgres database is enough for V1."
      id: "A-001"
  facts:
    - text: "Repository exists and validation script runs in CI."
      id: "F-001"

data_model:
  entities:
    - name: "User"
      description: "End-user account."
      fields:
        - name: "id"
          type: "uuid"
          pk: true
        - name: "email"
          type: "string"
          pii: high
      relationships:
        - target: "Session"
          cardinality: "1:N"

events:
  naming_convention: "domain.action_in_past_tense"
  catalog:
    - name: "auth.user_signed_up"
      description: "A new user completed signup."
      version: "1.0.0"
      schema_version: "1.0.0"
      classification:
        pii: high
        idempotency: required
        ordering: at_least_once
      emitted_by:
        - "api.auth"
      payload:
        type: object
        additionalProperties: false
        required:
          - user_id
          - occurred_at
        properties:
          user_id:
            type: string
            format: uuid
          occurred_at:
            type: string
            format: date-time
          plan:
            type: string
            enum:
              - free
              - pro

observability:
  logs:
    strategy: "Structured JSON logs; include correlation_id and trace ids when available."
    pii_policy: "No raw emails in info-level logs; use hashed identifiers where needed."
  errors:
    tool: "Sentry"
    policy: "Capture unhandled exceptions; tag with product_id and slice_id."
  metrics:
    tool: "PostHog"
    core_metrics:
      - key: "activation_completed"
        description: "User completed primary activation funnel step."
        type: event

context_recovery:
  canonical_summary: |
    This repository defines the agent-native product specification format.
    Agents should read spec/ first, then code, then tests.
  key_decisions:
    - "Specs are validated JSON/YAML; Markdown is optional mirror."
    - "Events are named with past-tense domain segments."
  domain_terms:
    - term: "slice"
      definition: "Vertical end-to-end feature increment spanning UI, API, DB, and telemetry."
    - term: "catalog"
      definition: "The list of event definitions under events.catalog."

decision_log:
  entries:
    - id: "DEC-001"
      date: "2026-04-09"
      decision: "Use parallel development cycle (framework skeleton + slice in sync)."
      reason: "Keeps boilerplate honest and reduces spec drift."
      alternatives:
        - "Framework-first (rejected)"
        - "Product-only with backfill (escape hatch)"
```

---

## File: `templates/slice-spec.yaml`

```yaml
# Template for a vertical slice spec. Copy to spec/examples/<slice_id>.yaml and fill.
spec_version: "1.0.0"
kind: slice
product_id: "CHANGE_ME"
parent_product_id: "CHANGE_ME"
slice_id: "CHANGE_ME"

metadata:
  title: "CHANGE_ME"
  status: draft
  owner: "CHANGE_ME"
  created_at: "CHANGE_ME"
  updated_at: "CHANGE_ME"
  tags: []

ideation:
  problem: ""
  user: ""
  goal: ""
  constraints: []
  success_metrics: []
  risks: []

design:
  objective: ""
  requirements: []
  system_design: ""
  tooling_decisions: []
  assumptions: []
  facts: []

data_model:
  entities: []

events:
  naming_convention: "domain.action_in_past_tense"
  catalog: []

observability:
  logs: {}
  errors: {}
  metrics: {}

context_recovery:
  canonical_summary: ""
  key_decisions: []
  domain_terms: []

decision_log:
  entries: []
```

---

## File: `interfaces/interfaces.yaml`

```yaml
# Provider-agnostic logical interfaces agents should implement or call via adapters.
version: "1.0.0"

interfaces:
  read_spec:
    description: "Load canonical spec from repo or registry."
    inputs:
      path:
        type: string
    outputs:
      spec:
        type: object

  validate_spec:
    description: "Validate a spec instance against product-spec.schema.json."
    inputs:
      instance:
        type: object
    outputs:
      valid:
        type: boolean
      errors:
        type: array

  emit_event:
    description: "Emit a structured domain event with envelope fields."
    inputs:
      name:
        type: string
      payload:
        type: object
      correlation_id:
        type: string
      occurred_at:
        type: string
        format: date-time
      emitted_by:
        type: string
    outputs:
      accepted:
        type: boolean

  record_error:
    description: "Send an error to the error tracking system."
    inputs:
      error:
        type: object
      fingerprint_tags:
        type: array

  capture_metric:
    description: "Capture product analytics event."
    inputs:
      key:
        type: string
      properties:
        type: object

policies:
  human_in_the_loop:
    required_for:
      - "Breaking schema migrations"
      - "PII policy changes"
      - "Security-sensitive tool grants"
```

---

## File: `.github/workflows/validate.yml`

```yaml
name: validate-spec

on:
  push:
    branches: [main, master]
  pull_request:

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
      - run: npm install
      - run: npm run validate
```

---

## Appendix A — `spec/schema/product-spec.schema.json`

Paste the following as valid JSON (single file):

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://ai-native-framework.local/schemas/product-spec.schema.json",
  "title": "AI-Native Product Spec",
  "type": "object",
  "additionalProperties": false,
  "required": [
    "spec_version",
    "kind",
    "product_id",
    "metadata",
    "ideation",
    "design",
    "data_model",
    "events",
    "observability",
    "context_recovery",
    "decision_log"
  ],
  "properties": {
    "spec_version": {
      "type": "string",
      "pattern": "^\\d+\\.\\d+\\.\\d+$"
    },
    "kind": {
      "type": "string",
      "enum": ["product", "slice"]
    },
    "product_id": {
      "type": "string",
      "minLength": 1,
      "pattern": "^[a-z0-9][a-z0-9_-]*$"
    },
    "slice_id": {
      "type": "string",
      "pattern": "^[a-z0-9][a-z0-9_-]*$"
    },
    "parent_product_id": {
      "type": "string",
      "pattern": "^[a-z0-9][a-z0-9_-]*$"
    },
    "metadata": {
      "type": "object",
      "additionalProperties": false,
      "required": ["title", "status", "owner", "created_at", "updated_at", "tags"],
      "properties": {
        "title": { "type": "string", "minLength": 1 },
        "status": {
          "type": "string",
          "enum": ["draft", "active", "deprecated", "archived"]
        },
        "owner": { "type": "string", "minLength": 1 },
        "created_at": { "type": "string", "format": "date-time" },
        "updated_at": { "type": "string", "format": "date-time" },
        "tags": {
          "type": "array",
          "items": { "type": "string" }
        }
      }
    },
    "ideation": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "problem",
        "user",
        "goal",
        "constraints",
        "success_metrics",
        "risks"
      ],
      "properties": {
        "problem": { "type": "string", "minLength": 1 },
        "user": { "type": "string", "minLength": 1 },
        "goal": { "type": "string", "minLength": 1 },
        "constraints": {
          "type": "array",
          "items": { "type": "string" }
        },
        "success_metrics": {
          "type": "array",
          "items": {
            "type": "object",
            "additionalProperties": false,
            "required": ["name", "definition"],
            "properties": {
              "name": { "type": "string", "minLength": 1 },
              "definition": { "type": "string", "minLength": 1 },
              "target": { "type": "string" }
            }
          }
        },
        "risks": {
          "type": "array",
          "items": {
            "type": "object",
            "additionalProperties": false,
            "required": ["description"],
            "properties": {
              "description": { "type": "string", "minLength": 1 },
              "mitigation": { "type": "string" }
            }
          }
        }
      }
    },
    "design": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "objective",
        "requirements",
        "system_design",
        "tooling_decisions",
        "assumptions",
        "facts"
      ],
      "properties": {
        "objective": { "type": "string", "minLength": 1 },
        "requirements": {
          "type": "array",
          "items": {
            "type": "object",
            "additionalProperties": false,
            "required": ["id", "priority", "statement"],
            "properties": {
              "id": { "type": "string", "minLength": 1 },
              "priority": {
                "type": "string",
                "enum": ["must", "should", "could"]
              },
              "statement": { "type": "string", "minLength": 1 }
            }
          }
        },
        "system_design": { "type": "string", "minLength": 1 },
        "tooling_decisions": {
          "type": "array",
          "items": {
            "type": "object",
            "additionalProperties": false,
            "required": ["decision", "reason"],
            "properties": {
              "decision": { "type": "string", "minLength": 1 },
              "reason": { "type": "string", "minLength": 1 },
              "alternatives_considered": {
                "type": "array",
                "items": { "type": "string" }
              }
            }
          }
        },
        "assumptions": {
          "type": "array",
          "items": {
            "type": "object",
            "additionalProperties": false,
            "required": ["id", "text"],
            "properties": {
              "id": { "type": "string", "minLength": 1 },
              "text": { "type": "string", "minLength": 1 }
            }
          }
        },
        "facts": {
          "type": "array",
          "items": {
            "type": "object",
            "additionalProperties": false,
            "required": ["id", "text"],
            "properties": {
              "id": { "type": "string", "minLength": 1 },
              "text": { "type": "string", "minLength": 1 }
            }
          }
        }
      }
    },
    "data_model": {
      "type": "object",
      "additionalProperties": false,
      "required": ["entities"],
      "properties": {
        "entities": {
          "type": "array",
          "items": {
            "type": "object",
            "additionalProperties": false,
            "required": ["name", "description", "fields"],
            "properties": {
              "name": { "type": "string", "minLength": 1 },
              "description": { "type": "string", "minLength": 1 },
              "fields": {
                "type": "array",
                "items": {
                  "type": "object",
                  "additionalProperties": false,
                  "required": ["name", "type"],
                  "properties": {
                    "name": { "type": "string", "minLength": 1 },
                    "type": { "type": "string", "minLength": 1 },
                    "pk": { "type": "boolean" },
                    "pii": {
                      "type": "string",
                      "enum": ["none", "low", "high"]
                    }
                  }
                }
              },
              "relationships": {
                "type": "array",
                "items": {
                  "type": "object",
                  "additionalProperties": false,
                  "required": ["target", "cardinality"],
                  "properties": {
                    "target": { "type": "string", "minLength": 1 },
                    "cardinality": { "type": "string", "minLength": 1 }
                  }
                }
              }
            }
          }
        }
      }
    },
    "events": {
      "type": "object",
      "additionalProperties": false,
      "required": ["naming_convention", "catalog"],
      "properties": {
        "naming_convention": {
          "type": "string",
          "enum": ["domain.action_in_past_tense"]
        },
        "catalog": {
          "type": "array",
          "items": {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "name",
              "description",
              "version",
              "schema_version",
              "classification",
              "emitted_by",
              "payload"
            ],
            "properties": {
              "name": {
                "type": "string",
                "pattern": "^[a-z0-9]+(\\.[a-z0-9_]+)+$"
              },
              "description": { "type": "string", "minLength": 1 },
              "version": {
                "type": "string",
                "pattern": "^\\d+\\.\\d+\\.\\d+$"
              },
              "schema_version": {
                "type": "string",
                "pattern": "^\\d+\\.\\d+\\.\\d+$"
              },
              "classification": {
                "type": "object",
                "additionalProperties": false,
                "required": ["pii", "idempotency", "ordering"],
                "properties": {
                  "pii": {
                    "type": "string",
                    "enum": ["none", "low", "high"]
                  },
                  "idempotency": {
                    "type": "string",
                    "enum": ["none", "recommended", "required"]
                  },
                  "ordering": {
                    "type": "string",
                    "enum": ["at_least_once", "effectively_exactly_once"]
                  }
                }
              },
              "emitted_by": {
                "type": "array",
                "minItems": 1,
                "items": { "type": "string", "minLength": 1 }
              },
              "payload": { "type": "object" }
            }
          }
        }
      }
    },
    "observability": {
      "type": "object",
      "additionalProperties": false,
      "required": ["logs", "errors", "metrics"],
      "properties": {
        "logs": {
          "type": "object",
          "additionalProperties": false,
          "required": ["strategy", "pii_policy"],
          "properties": {
            "strategy": { "type": "string", "minLength": 1 },
            "pii_policy": { "type": "string", "minLength": 1 }
          }
        },
        "errors": {
          "type": "object",
          "additionalProperties": false,
          "required": ["tool", "policy"],
          "properties": {
            "tool": { "type": "string", "minLength": 1 },
            "policy": { "type": "string", "minLength": 1 }
          }
        },
        "metrics": {
          "type": "object",
          "additionalProperties": false,
          "required": ["tool", "core_metrics"],
          "properties": {
            "tool": { "type": "string", "minLength": 1 },
            "core_metrics": {
              "type": "array",
              "items": {
                "type": "object",
                "additionalProperties": false,
                "required": ["key", "description", "type"],
                "properties": {
                  "key": { "type": "string", "minLength": 1 },
                  "description": { "type": "string", "minLength": 1 },
                  "type": { "type": "string", "minLength": 1 }
                }
              }
            }
          }
        }
      }
    },
    "context_recovery": {
      "type": "object",
      "additionalProperties": false,
      "required": ["canonical_summary", "key_decisions", "domain_terms"],
      "properties": {
        "canonical_summary": { "type": "string", "minLength": 1 },
        "key_decisions": {
          "type": "array",
          "items": { "type": "string", "minLength": 1 }
        },
        "domain_terms": {
          "type": "array",
          "items": {
            "type": "object",
            "additionalProperties": false,
            "required": ["term", "definition"],
            "properties": {
              "term": { "type": "string", "minLength": 1 },
              "definition": { "type": "string", "minLength": 1 }
            }
          }
        }
      }
    },
    "decision_log": {
      "type": "object",
      "additionalProperties": false,
      "required": ["entries"],
      "properties": {
        "entries": {
          "type": "array",
          "items": {
            "type": "object",
            "additionalProperties": false,
            "required": ["id", "date", "decision", "reason"],
            "properties": {
              "id": { "type": "string", "minLength": 1 },
              "date": { "type": "string", "format": "date" },
              "decision": { "type": "string", "minLength": 1 },
              "reason": { "type": "string", "minLength": 1 },
              "alternatives": {
                "type": "array",
                "items": { "type": "string" }
              }
            }
          }
        }
      }
    }
  },
  "allOf": [
    {
      "if": { "properties": { "kind": { "const": "slice" } } },
      "then": {
        "required": ["slice_id", "parent_product_id"],
        "properties": {
          "slice_id": {
            "type": "string",
            "pattern": "^[a-z0-9][a-z0-9_-]*$"
          },
          "parent_product_id": {
            "type": "string",
            "pattern": "^[a-z0-9][a-z0-9_-]*$"
          }
        }
      }
    }
  ]
}
```

---

## Notes for agents

- **Slice specs** require `slice_id` and `parent_product_id` (enforced by `allOf` in schema).
- Update `golden-product.yaml` when you add required fields to the schema.
- Keep `spec/policy/event-taxonomy.yaml` aligned with runtime emitters.
