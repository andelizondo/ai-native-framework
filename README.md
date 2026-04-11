# AI-Native Framework

![AI-Native Framework banner](assets/brand/governed-orchestration-banner.svg)

This repository is an AI-native operating system for building and running product-led companies. It is spec-driven, event-observable, human-governed, and provider-agnostic at the core.

The framework is designed for agents to execute structured work under explicit constraints, while humans retain authority for strategy, ambiguity, and high-stakes decisions.

## Core framework artifacts

- Machine-validated product and slice specifications
- Event and governance policy
- Provider-agnostic agent interface contracts
- Playbooks for repository governance, pull-request automation, and agent runtime context
- A repository-local agent surface: root [`AGENTS.md`](AGENTS.md) (first read for most agent tools), plus [`ai/PLAYBOOKS.md`](ai/PLAYBOOKS.md), [`ai/playbooks/`](ai/playbooks/), [`ai/SKILLS.md`](ai/SKILLS.md), [`ai/skills/`](ai/skills/), and [`ai/MEMORY.md`](ai/MEMORY.md)

## Authority Ladder

Higher items override lower items:

1. [`spec/schema/product-spec.schema.json`](spec/schema/product-spec.schema.json)
2. Validated artifacts under [`spec/examples/`](spec/examples/) and future `spec/processes/`
3. [`spec/policy/event-taxonomy.yaml`](spec/policy/event-taxonomy.yaml)
4. [`agents/interfaces.yaml`](agents/interfaces.yaml)
5. [`ai/playbooks/`](ai/playbooks/) (procedure bodies)
6. [`docs/AI_NATIVE_FRAMEWORK.md`](docs/AI_NATIVE_FRAMEWORK.md) and other explanatory `docs/*`
7. [`AGENTS.md`](AGENTS.md), [`ai/PLAYBOOKS.md`](ai/PLAYBOOKS.md), [`ai/SKILLS.md`](ai/SKILLS.md), [`ai/skills/`](ai/skills/), [`ai/MEMORY.md`](ai/MEMORY.md)

Root `AGENTS.md` and the `ai/` bundle are operationally important, but they do not override schema, policy, interface contracts, or playbook procedures.

## Operating Model

- **AI-first:** AI is a first-class subsystem, not an add-on.
- **API-first and modular:** boundaries should be composable, observable, and replaceable.
- **Event-driven:** meaningful state changes should emit structured events.
- **Persistent context:** durable knowledge belongs in versioned artifacts, not only in chat.
- **Provider-agnostic:** core business logic must not depend on one model vendor or one agent IDE.
- **Human-governed:** agents execute; humans decide under uncertainty.

Default division of labor:

- **Agents:** execution, coordination, iteration, analysis within declared constraints
- **Humans:** strategy, taste, ambiguity resolution, approvals for irreversible or high-stakes actions

The framework targets high leverage, not fake autonomy. A 90/10 automation-to-human ratio is an aspiration, and only valid when judgment checkpoints, confidence thresholds, and escalation rules are explicit.

## End-To-End Scope

The framework covers the full operating loop:

`intent -> discovery -> product -> build and ship -> go-to-market -> operations -> feedback and learning`

Primary artifacts across that loop include:

- product and slice specs
- event catalogs
- process playbooks
- decision records
- validation and observability evidence

## Playbooks

The playbooks turn repeated operational work into reusable procedures:

- [Repository foundation](ai/playbooks/repository-foundation.md) — CI, branch protection, merge policy, security defaults, governance files, and repository settings so the repo is safe before routine feature work.
- [Pull request execution loop](ai/playbooks/pull-request-execution-loop.md) — classification, review, residual-risk decisions, branch freshness, safe autofix, policy checks, and low-risk merge flow.
- [Agent context bundle](ai/playbooks/agent-context-bundle.md) — how to install and maintain root `AGENTS.md` and the `ai/` bundle (skills, playbooks, memory).

Together they cover governed collaboration, automatable PR policy, and portable agent bootstrap. None of them replaces schema or policy; each is written to stand alone, though **materializing a new repo** usually applies repository foundation first so later automation matches reality.

See [`ai/PLAYBOOKS.md`](ai/PLAYBOOKS.md) for the full playbook discovery index.

## Agent entry map

Most agent tools default to **root [`AGENTS.md`](AGENTS.md)**. After that, the layout mirrors skills vs playbooks:

| Location | Role |
| --- | --- |
| [`AGENTS.md`](AGENTS.md) | First read: authority, commands, merge and review rules |
| [`docs/AI_NATIVE_FRAMEWORK.md`](docs/AI_NATIVE_FRAMEWORK.md) | Full framework narrative (human- and agent-oriented prose) |
| [`ai/PLAYBOOKS.md`](ai/PLAYBOOKS.md) | Which **unitary procedure** to open under `ai/playbooks/` |
| [`ai/SKILLS.md`](ai/SKILLS.md) | Which **role/task skill** to open under `ai/skills/` |
| [`ai/MEMORY.md`](ai/MEMORY.md) | Durable repo facts and open loops |

Procedure bodies: [`ai/playbooks/`](ai/playbooks/). Skill bodies: [`ai/skills/`](ai/skills/). Normative machine rules: `spec/` and `agents/`.

## Agent bundle (`ai/`)

This repository keeps **one agent file at the repo root** and groups the rest under **`ai/`**:

- [`AGENTS.md`](AGENTS.md) — bootstrap contract, authority map, commands, and escalation rules (root)
- [`ai/PLAYBOOKS.md`](ai/PLAYBOOKS.md) — playbook discovery index (`ai/playbooks/` bodies)
- [`ai/SKILLS.md`](ai/SKILLS.md) — skill discovery index (`ai/skills/` bodies)
- [`ai/MEMORY.md`](ai/MEMORY.md) — durable repository memory, open loops, and recent decisions

These files coordinate how agents run. Durable policy still belongs in schema, `ai/playbooks/`, interfaces, and other canonical artifacts.

## Quick Start

```bash
npm install
npm run validate
```

CI runs the same validation via [`.github/workflows/validate.yml`](.github/workflows/validate.yml).

## Repository Layout

| Path | Role |
| --- | --- |
| `spec/schema/` | JSON Schema for product and slice specs |
| `spec/examples/` | Validated example specifications |
| `spec/policy/` | Event naming, PII, idempotency, ordering, and deprecation rules |
| `templates/` | Reusable templates including slice and agent-context bundle templates |
| `agents/` | Provider-agnostic logical interfaces |
| `scripts/` | Validation tooling |
| `AGENTS.md` | Agent bootstrap contract (sole agent file at repo root) |
| `ai/PLAYBOOKS.md` | Playbook discovery index |
| `ai/playbooks/` | On-demand procedure playbooks |
| `ai/SKILLS.md` | Skill discovery index |
| `ai/skills/` | On-demand skill bodies |
| `ai/MEMORY.md` | Durable operating memory |
| `docs/AI_NATIVE_FRAMEWORK.md` | Full framework prose |
| `REPO_SCAFFOLD.md` | Copy-paste scaffold for materializing framework-aligned repos |

## Current Validation Surface

The canonical local validation command is:

```bash
npm run validate
```

Today that validates example specs against the product schema. As the framework grows, additional process schemas and workflow artifacts should be validated with the same discipline.

## Design Rules

- Ship vertical slices, not disconnected layers.
- Update schemas, examples, policies, and docs together when behavior changes.
- Keep agent instructions versioned and concise.
- Do not treat transient chat as the system of record.
- Avoid vendor-specific assumptions in core policy.

## Recommended Reading Order

**Agents:** start at [`AGENTS.md`](AGENTS.md), then follow its read order (summarized here):

1. [`README.md`](README.md)
2. [`docs/AI_NATIVE_FRAMEWORK.md`](docs/AI_NATIVE_FRAMEWORK.md)
3. [`ai/PLAYBOOKS.md`](ai/PLAYBOOKS.md)
4. The specific files under [`ai/playbooks/`](ai/playbooks/) or `spec/` relevant to the task
5. [`ai/SKILLS.md`](ai/SKILLS.md)
6. Only the specific files under [`ai/skills/`](ai/skills/) selected from the index
7. [`ai/MEMORY.md`](ai/MEMORY.md)
