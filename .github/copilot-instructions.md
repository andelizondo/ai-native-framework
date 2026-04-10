# Repository instructions for GitHub Copilot

Use `docs/AI_NATIVE_FRAMEWORK_COMPLETE.md` as the primary operating guideline for this repository.

When reviewing or proposing changes:

- CI: `p1-review-adapter` runs `scripts/review-adapter.mjs` (with `P1_INITIAL_RISK` from `scripts/p1-risk-from-paths.mjs` + `spec/policy/p1-path-risk.json`) and uploads `review-findings.json`. `p1-apply-residual` then sets `residual:*` labels from `residual_assessment` (after P1 guardrails in the adapter). Schema: `spec/schema/review-findings.schema.json`.
- Follow the playbooks in `docs/PLAYBOOKS.md`.
- Apply `docs/P1_PR_EXECUTION_LOOP.md` when reasoning about pull requests.
- Treat the framework as provider-agnostic. Do not introduce vendor-specific assumptions into core policy unless the change is explicitly implementation-specific.
- Prefer conservative escalation over unsafe approval when the change touches workflows, schemas, policy, security, or protected repository surfaces.
- For this repository, the canonical validation command is `npm run validate`.
- Distinguish blocking risks from non-blocking suggestions.
- Preserve branch protection, auditability, and human checkpoints for medium- and high-risk changes.
