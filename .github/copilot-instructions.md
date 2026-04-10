# Repository instructions for GitHub Copilot

Use `docs/AI_NATIVE_FRAMEWORK_COMPLETE.md` as the primary operating guideline for this repository.

When reviewing or proposing changes:

- CI workflow `p1-review-adapter` writes machine-readable `review-findings.json` (schema: `spec/schema/review-findings.schema.json`) via `scripts/review-adapter.mjs`; policy can consume that artifact in a later step.
- Follow the playbooks in `docs/PLAYBOOKS.md`.
- Apply `docs/P1_PR_EXECUTION_LOOP.md` when reasoning about pull requests.
- Treat the framework as provider-agnostic. Do not introduce vendor-specific assumptions into core policy unless the change is explicitly implementation-specific.
- Prefer conservative escalation over unsafe approval when the change touches workflows, schemas, policy, security, or protected repository surfaces.
- For this repository, the canonical validation command is `npm run validate`.
- Distinguish blocking risks from non-blocking suggestions.
- Preserve branch protection, auditability, and human checkpoints for medium- and high-risk changes.
