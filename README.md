# AI-native framework (agent spec)

**Canonical source of truth for agents:** [`spec/schema/product-spec.schema.json`](spec/schema/product-spec.schema.json) and validated instances under [`spec/examples/`](spec/examples/).  
**Policy:** [`spec/policy/event-taxonomy.yaml`](spec/policy/event-taxonomy.yaml).  
**Agent tool contracts:** [`agents/interfaces.yaml`](agents/interfaces.yaml).  
**Operating framework (normative prose, v0.1):** [`docs/AI_NATIVE_FRAMEWORK_COMPLETE.md`](docs/AI_NATIVE_FRAMEWORK_COMPLETE.md) - read after `spec/` when bootstrapping company-wide behavior.  
**Playbooks:** [`docs/PLAYBOOKS.md`](docs/PLAYBOOKS.md) - reusable procedures for bootstrapping and operating framework-aligned repos.  
**Agent context bundle:** [`AGENTS.md`](AGENTS.md), [`SKILLS.md`](SKILLS.md), and [`MEMORY.md`](MEMORY.md) - repository-local operating context for coding agents and assistants.  
Optional human-readable mirrors can live under `docs/` (generate or keep in sync).

## Quick start

```bash
npm install
npm run validate
```

CI runs the same check (see [`.github/workflows/validate.yml`](.github/workflows/validate.yml)).

## Layout

| Path                                   | Role                                                                 |
| -------------------------------------- | -------------------------------------------------------------------- |
| `spec/schema/`                         | JSON Schema for product and slice specs                              |
| `spec/examples/`                       | Golden + future validated YAML specs                                 |
| `spec/policy/`                         | Event naming, PII, idempotency, deprecation rules                    |
| `templates/`                           | `slice-spec.yaml` plus `agents-template.md`, `skills-template.md`, `memory-template.md` |
| `agents/`                              | Provider-agnostic logical interfaces                                 |
| `scripts/`                             | `validate-spec.mjs` (AJV + YAML)                                     |
| `AGENTS.md`                            | Agent bootstrap contract: authority, workflow, and repo-specific rules |
| `SKILLS.md`                            | Reusable capability registry and procedure index                     |
| `MEMORY.md`                            | Durable working memory, current state, and update discipline         |
| `docs/AI_NATIVE_FRAMEWORK_COMPLETE.md` | Full operating framework (agent-oriented; initial v0.1)              |
| `docs/PLAYBOOKS.md`                    | Index of reusable playbooks and operating procedures                 |
| `REPO_SCAFFOLD.md`                     | Full copy-paste bundle + Appendix (keep in sync when editing schema) |


## Principles

- **Parallel cycle:** each shipped vertical slice updates schemas, examples, and policies together.
- **Agent-primary:** breaking changes go through schema + policy; docs follow.
- **Context is infrastructure:** agent runtime guidance belongs in versioned repo artifacts, not only in transient prompts.
- **`kind: slice`** requires `slice_id` and `parent_product_id` (see schema `allOf`).
