# MEMORY.md

This file stores durable repository memory for agents. It is not a transcript and it is not a dumping ground for temporary notes.

## Stable Facts

- This repository is the canonical home of an AI-native operating framework for product-led companies.
- Canonical truth is ordered by the authority ladder in `AGENTS.md`, with schema and policy above explanatory Markdown.
- The repository currently defines the following first-class operating playbooks:
  - `P0` for repository foundation
  - `P1` for pull request execution
  - `P2` for the repository-local agent context bundle standard
- The canonical validation command is `npm run validate`.
- The framework is explicitly provider-agnostic at the core layer.
- For this repository, pull requests should be opened ready for review by default unless the user explicitly asks for a draft PR.
- For this repository, agents must wait for every configured merge gate on the current head SHA to complete successfully before merging, even if host branch protection is missing or misconfigured.
- For this repository, CodeRabbit should be allowed to start automatically; manual `@coderabbitai review` comments are only for two cases: no reviewer signal appears after roughly 15 seconds on a new head SHA, or the reviewer is still in progress after 5 minutes and the user explicitly agrees to trigger recovery.
- The repository-local skills system now uses `SKILLS.md` as the discovery index and `skills/` for on-demand skill bodies.
- The first top-level repository-local skills are `Designer`, `PM`, and `Developer`.

## Current Bundle State

- `AGENTS.md` is the bootstrap file for agents entering the repository.
- `SKILLS.md` is the discovery index for repeated work in this repo.
- `skills/` contains the full skill bodies loaded only when selected from the index.
- `MEMORY.md` is reserved for durable facts, dated decisions, and open loops worth carrying across sessions.

## Active Open Loops

- Encode P0, P1, and P2 as machine-readable process artifacts under future `spec/processes/`.

## Recent Decisions

- 2026-04-10: Adopted a repository-local agent context bundle built around `AGENTS.md`, `SKILLS.md`, and `MEMORY.md`.
- 2026-04-10: Added `P2 - Agent context bundle` as a first-class playbook in the framework.
- 2026-04-11: Standardized the repository-local skills system on a low-cost `SKILLS.md` index plus on-demand `skills/` files, and seeded the first role-oriented skills as `Designer`, `PM`, and `Developer`.
- 2026-04-11: Standardized P1 on CodeRabbit auto-review via `.coderabbit.yaml` and moved low-risk merge execution to Mergify via `.mergify.yml`.
- 2026-04-11: Tightened Dependabot scheduling for `npm` and GitHub Actions on `main`, grouped routine version updates, and labeled dependency PRs for the low-risk automation path.
- 2026-04-11: Set repository-local agent behavior to open pull requests ready for review by default; draft PRs require an explicit user request.
- 2026-04-11: Tightened P1 and `main` protection so merges wait for the full merge-gate set (`validate`, `decide`, and reviewer status) even if host protection is misconfigured.
- 2026-04-11: Standardized CodeRabbit handling so automatic review is the default path and manual `@coderabbitai review` comments are only for stalled-review recovery.
- 2026-04-11: Refined CodeRabbit recovery policy: auto-trigger only if no reviewer signal appears after about 15 seconds; once review has clearly started, poll up to 5 minutes and then ask the user before posting `@coderabbitai review`.
- 2026-04-11: CodeRabbit `request_changes_workflow` enabled; P1/AGENTS require visible per-finding closure (fix or stated decision) before merge—green status alone is not enough.
- 2026-04-11: CodeRabbit finding closure should be recorded in the review thread itself when possible, and stale or cancelled required jobs should be rerun on the current head before considering control-plane changes.
- 2026-04-11: `p1-policy` `decide` polls required reviewer commit statuses (shared wait budget across contexts; `P1_POLICY_REVIEWER_STATUS_*` vars) so the check stays in progress while CodeRabbit is pending instead of failing immediately.
- 2026-04-11: `decide` refreshes issue labels after earlier gates and polls for a `residual:*` label (`P1_POLICY_RESIDUAL_LABEL_*` vars) so the residual risk engine can land slightly after `decide` starts without failing red on a stale label read.

## Update Rules

- Add facts only if they are likely to matter in future sessions.
- Remove or rewrite facts when they become stale.
- Close open loops instead of letting this file grow indefinitely.
- If a memory item becomes normative policy, move it into schema, playbook, or framework docs and leave only a short pointer here.
