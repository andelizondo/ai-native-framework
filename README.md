# AI-native framework (agent spec)

**Canonical source of truth for agents:** [`spec/schema/product-spec.schema.json`](spec/schema/product-spec.schema.json) and validated instances under [`spec/examples/`](spec/examples/).  
**Policy:** [`spec/policy/event-taxonomy.yaml`](spec/policy/event-taxonomy.yaml).  
**Agent tool contracts:** [`agents/interfaces.yaml`](agents/interfaces.yaml).  
**Operating framework (normative prose, v0.1):** [`docs/AI_NATIVE_FRAMEWORK_COMPLETE.md`](docs/AI_NATIVE_FRAMEWORK_COMPLETE.md) - read after `spec/` when bootstrapping company-wide behavior.  
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
| `templates/`                           | Empty `slice-spec.yaml` template                                     |
| `agents/`                              | Provider-agnostic logical interfaces                                 |
| `scripts/`                             | `validate-spec.mjs` (AJV + YAML)                                     |
| `docs/AI_NATIVE_FRAMEWORK_COMPLETE.md` | Full operating framework (agent-oriented; initial v0.1)              |
| `REPO_SCAFFOLD.md`                     | Full copy-paste bundle + Appendix (keep in sync when editing schema) |


## Principles

- **Parallel cycle:** each shipped vertical slice updates schemas, examples, and policies together.
- **Agent-primary:** breaking changes go through schema + policy; docs follow.
- **`kind: slice`** requires `slice_id` and `parent_product_id` (see schema `allOf`).
