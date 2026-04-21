# MEMORY.md

Durable repository memory only. Keep one-line facts, open loops, and dated decisions. Move normative detail into playbooks, docs, or schema.

## Stable Facts

- Canonical framework home: this repository.
- Authority order: schema -> validated examples/processes -> policy -> interfaces -> playbooks -> docs -> agent bundle.
- Canonical validation command: `npm run validate`.
- Provider-agnostic core is mandatory.
- Provider-agnostic tool contracts live in `interfaces/interfaces.yaml`; repo-local agent runtime lives under `ai/`.
- Agent runtime layout: root `AGENTS.md`; `ai/SKILLS.md`; `ai/skills/`; `ai/PLAYBOOKS.md`; `ai/playbooks/`; `ai/MEMORY.md`.
- Top-level repo-local skills: `Designer`, `PM`, `Developer`, `Framework Keeper`, `Quality Engineer`.
- Root `version.txt` is the canonical repo release value; production telemetry should align with tag form `vX.Y.Z`.
- Feature PRs open ready for review by default unless the user asks for draft.
- Feature branches target `staging`; `staging` -> `main` is the governed production path.
- Pull requests must not merge until every configured gate on the current head SHA is green.
- CodeRabbit is substance-gating: thread closure needs a visible outcome, not just a green check.
- Wait for CodeRabbit auto-review first; use `@coderabbitai review` only for stalled runs.
- If current-head thread closure is complete but `CHANGES_REQUESTED` persists, use the canonical approval prompt from the PR playbook.
- Stale bot reviews on older SHAs may be dismissed by a maintainer only after current-head closure is complete and documented.
- Keep `spec/policy/event-taxonomy.yaml` aligned with runtime emitters.
- Sentry is part of the default implementation surface for frontend and backend feature work in this repo.
- `docs/ANALYTICS_STANDARD.md` and `docs/QUALITY_STANDARD.md` are separate governed standards; do not collapse them.
- Quality maturity phases are defined in `docs/QUALITY_STANDARD.md`; agents do not self-advance phases.
- For `products/dashboard`, auth code outside adapters must depend on `products/dashboard/lib/auth/`.
- Dashboard auth lifecycle must flow through shared analytics and monitoring identity helpers.
- GitHub issue resolution uses grouped fixes when issues share a real root cause.
- Sentry issue resolution requires assignment, in-flight notes, evidence-based closure, and PR linkage.

## Active Open Loops

- Encode playbooks as machine-readable process artifacts under future `spec/processes/`.
- Add a process artifact for the Quality Standard once process schemas exist.

## Recent Decisions

- 2026-04-10: Adopted the repository-local agent context bundle built around root `AGENTS.md` plus `ai/`.
- 2026-04-11: Standardized repository-local skills and playbooks as index + on-demand body surfaces under `ai/`.
- 2026-04-11: Standardized PR policy on CodeRabbit auto-review, Mergify execution, and executing-agent merge ownership.
- 2026-04-12: Renamed `agents/` to `interfaces/` for provider-agnostic capability contracts.
- 2026-04-13: Standardized repo-level release automation on `release-please`, manifest mode, and root `version.txt`.
- 2026-04-13: Added `docs/QUALITY_STANDARD.md` and Phase 1 verification surfaces for `products/dashboard`.
- 2026-04-17: Canonicalized dashboard auth as a governed product slice with adapter isolation and shared identity lifecycle helpers.
- 2026-04-18: Added governed playbooks for resolving GitHub issues and Sentry incidents.
- 2026-04-18: Adopted the 3-tier environment model: production, staging, development.
- 2026-04-19: Canonicalized `staging` -> `main` promotion, back-merge rules, Mergify queue behavior, and Supabase environment separation.
- 2026-04-21: Default bootstrap no longer loads `docs/AI_NATIVE_FRAMEWORK.md` unless the user references The Framework or the task needs framework prose; always-loaded surfaces were compacted to reduce token cost.

## Update Rules

- Add only facts likely to matter in future sessions.
- Rewrite or remove stale facts.
- Close open loops instead of accumulating historical detail.
- If an item becomes normative policy, move it into a playbook, doc, or schema and leave only a pointer here.
