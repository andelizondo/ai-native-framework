# MEMORY.md

This file stores durable repository memory for agents. It is not a transcript and it is not a dumping ground for temporary notes.

## Stable Facts

- This repository is the canonical home of an AI-native operating framework for product-led companies.
- Canonical truth is ordered by the authority ladder in `AGENTS.md`, with schema and policy above explanatory Markdown.
- The repository currently defines the following first-class operating playbooks (each is atomic; see `ai/PLAYBOOKS.md` for optional bootstrap order):
  - `ai/playbooks/repository-foundation.md`
  - `ai/playbooks/pull-request-execution-loop.md`
  - `ai/playbooks/agent-context-bundle.md`
  - `ai/playbooks/framework-review.md`
  - `ai/playbooks/release-management.md`
- The canonical validation command is `npm run validate`.
- The framework is explicitly provider-agnostic at the core layer.
- Provider-agnostic logical tool contracts live under `interfaces/` (`interfaces/interfaces.yaml`), separate from the repository-local agent runtime bundle under `ai/`.
- Repository release versioning now uses root `version.txt` as the canonical repo-level runtime release source, with production telemetry expected to align to the GitHub tag form `vX.Y.Z`.
- For this repository, pull requests should be opened ready for review by default unless the user explicitly asks for a draft PR.
- For this repository, agents must wait for every configured merge gate on the current head SHA to complete successfully before merging, even if host branch protection is missing or misconfigured.
- For this repository, CodeRabbit should be allowed to start automatically; manual `@coderabbitai review` comments are only for two cases: no reviewer signal appears after roughly 15 seconds on a new head SHA, or the reviewer is still in progress after 5 minutes and the user explicitly agrees to trigger recovery.
- Agent runtime layout: root `AGENTS.md` only; `ai/SKILLS.md` and `ai/skills/` for skills; `ai/PLAYBOOKS.md` and `ai/playbooks/` for unitary procedures; `ai/MEMORY.md` for durable memory.
- The top-level repository-local skills are `Designer`, `PM`, `Developer`, and `Framework Keeper`.
- Keep `spec/policy/event-taxonomy.yaml` aligned with runtime emitters (event names, envelope fields, and payload shapes must stay consistent across policy, specs, and product code).
- For product features in this repository, Sentry should be considered part of the default implementation surface for both frontend and backend work; detailed feature-level expectations live in `ai/skills/developer.md`.
- The framework defines two first-class governed documentation standards: `docs/ANALYTICS_STANDARD.md` (events, PII, error monitoring) and `docs/QUALITY_STANDARD.md` (verification, testing, evals, release confidence). They are separate surfaces that cross-reference each other; do not collapse them.
- The Quality Standard defines 3 maturity phases for products: Phase 1 (Tooling Foundation), Phase 2 (AI Reliability), Phase 3 (Scaling Confidence). Phase advancement requires checking off the required list in the standard; agents must not self-advance a phase.

## Current Bundle State

- `AGENTS.md` at the repository root is the first-read bootstrap file for agents.
- `ai/SKILLS.md` is the discovery index for role- and task-oriented skills.
- `ai/skills/` contains the full skill bodies loaded only when selected from the index.
- `ai/PLAYBOOKS.md` indexes unitary procedures; bodies live in `ai/playbooks/`.
- `ai/MEMORY.md` is reserved for durable facts, dated decisions, and open loops worth carrying across sessions.

## Active Open Loops

- Encode the current framework playbooks as machine-readable process artifacts under future `spec/processes/`.
- Add `spec/processes/quality-standard-process.yaml` once process schemas exist, to machine-validate phase criteria and gate rules.

## Recent Decisions

- 2026-04-11: Pull request playbook and `AGENTS.md` now state explicitly that the **executing agent** owns **merge completion** (or verifying merge-queue merge) when gates are green and policy allows; bounded polling or operator signal preferred over endless waits.
- 2026-04-11: Agent bundle consolidated under `ai/` (indices, `playbooks/`, `skills/`, `MEMORY.md`); root keeps only `AGENTS.md` as the common entry point for tools. P0/P1/P2 remain de-emphasized as playbook identity (workflows may still use `p1-*` / `P1_*` names for traceability).
- 2026-04-10: Adopted a repository-local agent context bundle built around `AGENTS.md` and files under `ai/`.
- 2026-04-10: Added the agent context bundle as a first-class playbook in the framework.
- 2026-04-11: Standardized the repository-local skills system on a low-cost `ai/SKILLS.md` index plus on-demand `ai/skills/` files, and seeded the first role-oriented skills as `Designer`, `PM`, and `Developer`.
- 2026-04-11: Standardized pull request review policy on CodeRabbit auto-review via `.coderabbit.yaml` and moved low-risk merge execution to Mergify via `.mergify.yml`.
- 2026-04-11: Tightened Dependabot scheduling for `npm` and GitHub Actions on `main`, grouped routine version updates, and labeled dependency PRs for the low-risk automation path.
- 2026-04-11: Set repository-local agent behavior to open pull requests ready for review by default; draft PRs require an explicit user request.
- 2026-04-11: Tightened pull request merge policy and `main` protection so merges wait for the full merge-gate set (`validate`, `decide`, and reviewer status) even if host protection is misconfigured.
- 2026-04-11: Standardized CodeRabbit handling so automatic review is the default path and manual `@coderabbitai review` comments are only for stalled-review recovery.
- 2026-04-11: Refined CodeRabbit recovery policy: auto-trigger only if no reviewer signal appears after about 15 seconds; once review has clearly started, poll up to 5 minutes and then ask the user before posting `@coderabbitai review`.
- 2026-04-11: CodeRabbit `request_changes_workflow` enabled; pull request playbook and `AGENTS.md` require visible per-finding closure (fix or stated decision) before merge—green status alone is not enough.
- 2026-04-11: CodeRabbit finding closure should be recorded in the review thread itself when possible, and stale or cancelled required jobs should be rerun on the current head before considering control-plane changes.
- 2026-04-11: `p1-policy` `decide` polls required reviewer commit statuses (shared wait budget across contexts; `P1_POLICY_REVIEWER_STATUS_*` vars) so the check stays in progress while CodeRabbit is pending instead of failing immediately.
- 2026-04-11: `decide` refreshes issue labels after earlier gates and polls for a `residual:*` label (`P1_POLICY_RESIDUAL_LABEL_*` vars) so the residual risk engine can land slightly after `decide` starts without failing red on a stale label read.
- 2026-04-11: Added `Framework Keeper` as a repository-local skill and `ai/playbooks/framework-review.md` as the canonical procedure for auditing the framework itself for consistency, efficiency, and predictability.
- 2026-04-12: Renamed `agents/` to `interfaces/` so provider-agnostic logical tool contracts are named for their actual role and remain distinct from the runtime bootstrap bundle under `ai/`.
- 2026-04-12: When repository work is requested “via PR” or to “open a PR,” default execution should follow the pull request execution loop playbook rather than treating PR creation as a standalone publication step.
- 2026-04-12: Tightened `docs/AI_NATIVE_FRAMEWORK.md` to prefer summary-level routing in large framework sections, keep detailed operating logic in canonical playbooks, pair `ai/SKILLS.md` with `ai/PLAYBOOKS.md` as adjacent but distinct surfaces, and use `skill layer` / `workflow library` terminology instead of the older `capability layer` / `process library` wording.
- 2026-04-12: Recorded in Stable Facts that `spec/policy/event-taxonomy.yaml` must stay aligned with runtime emitters (PR #44 / dashboard product wiring).
- 2026-04-12: Standardized repository-local developer guidance so Sentry is expected for frontend and backend feature work by default; the detailed required features and decision rules live in `ai/skills/developer.md`.
- 2026-04-12: For review-finding closure, agents should reply directly on each CodeRabbit thread when they fix or disposition a finding; consolidated PR comments do not replace per-thread accounting, and agents should still post the direct reply even if CodeRabbit later auto-resolves the thread after re-review.
- 2026-04-12 (PR #46 closure): **CodeRabbit rate limits** and **stale submitted reviews** can block merge even when the reviewer **status** is green. After rate-limit delays, retry `@coderabbitai review` on the current head; if **`CHANGES_REQUESTED`** remains only from older SHAs after thread closure, a maintainer may dismiss stale submissions per `ai/playbooks/pull-request-execution-loop.md` (finding closure, item 7). For **Mergify**, re-queue with `@mergifyio queue` plus the queue name in `.mergify.yml` (e.g. `low-risk`); clear a **`dequeued`** label if it blocks retry.
- 2026-04-13: Standardized repository-level release automation on `release-please` in manifest mode with repo-wide SemVer tags, a dedicated `RELEASE_PLEASE_TOKEN` requirement for triggering downstream workflows, and a canonical release-management playbook under `ai/playbooks/release-management.md`.
- 2026-04-13: Standardized dashboard release telemetry on a single app-release value derived from root `version.txt` for production builds and commit SHA fallback elsewhere; Sentry release sync on GitHub `release.published` is optional and activates only when Sentry secrets/vars are configured.
- 2026-04-13: Established single-release-source principle for Sentry configurations: one `const release = getServerSentryRelease()` call drives both `Sentry.init({ release })` and `initialScope.tags.app_release` so the two values can never diverge when `SENTRY_RELEASE` is overridden externally. Never call `getAppRelease()` and a Sentry-specific resolver separately and assign them to different fields.
- 2026-04-13: Standardized file-path resolution for repo-root artifacts consumed by nested packages: use `__dirname`-relative candidate paths (primary: `path.resolve(__dirname, "../../version.txt")`; fallback: `path.resolve(__dirname, "version.txt")`) rather than `process.cwd()`-relative paths so lookups are stable across build entrypoints regardless of invocation directory.
- 2026-04-13: Configured CodeRabbit to skip automated review of release-please PRs via `ignore_title_patterns: ["^chore: release"]` in `.coderabbit.yaml` to eliminate review overhead on machine-generated release commits. Pattern matches the configured `pull-request-title-pattern` in `release-please-config.json` (`"chore: release ${version}"`).
- 2026-04-13: Added `docs/QUALITY_STANDARD.md` as a first-class framework standard covering verification layers, merge-gate model, CI execution model, 3-phase maturity (Tooling Foundation → AI Reliability → Scaling Confidence), dashboard reference expectations, agent responsibilities, and incident-to-regression discipline. Default stack: Vitest, RTL, MSW, Playwright, Sentry, PostHog, Vercel previews. Keep Analytics Standard as a separate governed surface; the two cross-reference each other at observability and production feedback loop boundaries.
- 2026-04-13: Implemented Phase 1 (Tooling Foundation) for products/dashboard: Vitest + RTL + MSW unit/component/integration tests, Playwright critical-path E2E + axe accessibility, `test.yml` and `e2e.yml` CI workflows (both added as blocking gates in `.mergify.yml`), nightly.yml for full suite. Framework artifacts: `ai/playbooks/quality-standard-execution.md` (PR gate loop, nightly triage, incident-to-regression), `ai/skills/quality-engineer.md` (skill body). Merge gate model now requires: validate + test + e2e + CodeRabbit + decide.
- 2026-04-13: The `e2e` CI check triggers via GitHub `deployment_status` event (Vercel preview must be active). `BASE_URL` env var is passed from `github.event.deployment_status.environment_url`. If Vercel is not connected, the e2e check will not run — escalate to human operator rather than skipping the gate.

## Update Rules

- Add facts only if they are likely to matter in future sessions.
- Remove or rewrite facts when they become stale.
- Close open loops instead of letting this file grow indefinitely.
- If a memory item becomes normative policy, move it into schema, playbook, or framework docs and leave only a short pointer here.
