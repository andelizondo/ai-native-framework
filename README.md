# AI-Native Framework

![AI-Native Framework banner](assets/brand/governed-orchestration-banner.svg)

This repository is an AI-native operating system for building and running product-led companies. It is spec-driven, event-observable, human-governed, and provider-agnostic at the core.

The framework is designed for agents to execute structured work under explicit constraints, while humans retain authority for strategy, ambiguity, and high-stakes decisions.

## Core framework artifacts

- Machine-validated product and slice specifications
- Event and governance policy
- Provider-agnostic agent interface contracts
- Playbooks for repository governance, pull-request automation, and agent runtime context
- A repository-local context bundle for agents: `AGENTS.md`, `SKILLS.md`, `skills/`, and `MEMORY.md`

## Authority Ladder

Higher items override lower items:

1. [`spec/schema/product-spec.schema.json`](spec/schema/product-spec.schema.json)
2. Validated artifacts under [`spec/examples/`](spec/examples/) and future `spec/processes/`
3. [`spec/policy/event-taxonomy.yaml`](spec/policy/event-taxonomy.yaml)
4. [`agents/interfaces.yaml`](agents/interfaces.yaml)
5. [`docs/AI_NATIVE_FRAMEWORK.md`](docs/AI_NATIVE_FRAMEWORK.md) and other `docs/*`
6. [`AGENTS.md`](AGENTS.md), [`SKILLS.md`](SKILLS.md), [`skills/`](skills/), [`MEMORY.md`](MEMORY.md)

The root agent context bundle is operationally important, but it does not override schema, policy, or interface contracts.

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

1. [`docs/P0_REPOSITORY_FOUNDATION.md`](docs/P0_REPOSITORY_FOUNDATION.md)  
   Establish repository governance before feature work begins: CI, branch protection, merge policy, security defaults, governance files, and repository settings.
2. [`docs/P1_PR_EXECUTION_LOOP.md`](docs/P1_PR_EXECUTION_LOOP.md)  
   Automate pull request classification, review, residual-risk decisions, branch freshness, safe autofix, policy checks, and low-risk merge flow.
3. [`docs/P2_AGENT_CONTEXT_BUNDLE.md`](docs/P2_AGENT_CONTEXT_BUNDLE.md)  
   Install and maintain the repository-local runtime standard for agents using `AGENTS.md`, `SKILLS.md`, `skills/`, and `MEMORY.md`.

Together:

- `P0` makes the repo safe to operate
- `P1` makes the PR loop automatable under explicit policy
- `P2` makes agent behavior portable, inspectable, and durable across sessions

## Agent Context Bundle

This repository adopts the modern agent runtime bundle explicitly:

- [`AGENTS.md`](AGENTS.md) - bootstrap contract, authority map, commands, and escalation rules
- [`SKILLS.md`](SKILLS.md) - low-cost discovery index for repository-local skills
- [`skills/`](skills/) - on-demand skill bodies loaded only when selected from the index
- [`MEMORY.md`](MEMORY.md) - durable repository memory, open loops, and recent decisions

These files are for runtime coordination. Durable policy still belongs in schema, playbooks, interfaces, and other canonical artifacts.

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
| `AGENTS.md` | Agent bootstrap contract |
| `SKILLS.md` | Skill discovery index |
| `skills/` | On-demand skill bodies |
| `MEMORY.md` | Durable operating memory |
| `docs/AI_NATIVE_FRAMEWORK.md` | Full framework prose |
| `docs/PLAYBOOKS.md` | Playbook index |
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

1. [`README.md`](README.md)
2. [`docs/AI_NATIVE_FRAMEWORK.md`](docs/AI_NATIVE_FRAMEWORK.md)
3. [`docs/PLAYBOOKS.md`](docs/PLAYBOOKS.md)
4. The specific playbook or spec files relevant to the task
5. [`AGENTS.md`](AGENTS.md)
6. [`SKILLS.md`](SKILLS.md)
7. Only the specific files under [`skills/`](skills/) selected from the index
8. [`MEMORY.md`](MEMORY.md)
