# AGENTS.md

## Purpose

This repository defines an AI-native operating framework for product-led companies. The canonical system lives in schema, policy, interfaces, and playbooks. **`AGENTS.md` is the only agent-centric file at the repository root**; every other agent runtime artifact lives under **`ai/`** (indices, skills, playbooks, memory). Long-form framework narrative stays in **`docs/`**.

## Read Order

You are reading the first-read entry point. After this file, read the following before making non-trivial changes:

1. `README.md`
2. `docs/AI_NATIVE_FRAMEWORK.md`
3. `ai/PLAYBOOKS.md`
4. The specific files under `ai/playbooks/` or `spec/` relevant to the task
5. `ai/SKILLS.md`
6. Only the specific `ai/skills/*.md` files selected from `ai/SKILLS.md`
7. `ai/MEMORY.md`

## Authority Ladder

Higher items override lower items:

1. `spec/schema/*`
2. Validated artifacts under `spec/examples/*` and future `spec/processes/*`
3. `spec/policy/*`
4. `interfaces/interfaces.yaml`
5. `ai/playbooks/*.md`
6. `docs/*` (framework prose and other explanatory docs)
7. `AGENTS.md`, `ai/PLAYBOOKS.md`, `ai/SKILLS.md`, `ai/skills/*.md`, `ai/MEMORY.md`

If two sources conflict, follow the higher source and update the lower one if that is within scope.

## Canonical Commands

- Install: `npm install`
- Validate framework artifacts: `npm run validate`

If you change schema, examples, policy, templates, or playbooks, run `npm run validate` before concluding work.

## Working Rules

- Keep the framework provider-agnostic. Do not encode a single model vendor or IDE as core policy.
- Treat specs, policy, and playbooks as the durable operating system. This file and `ai/` are bootstrap and routing surfaces, not a replacement for canonical artifacts.
- Prefer updating the framework and playbooks together when a process change affects repository behavior.
- Keep repository-local agent instructions concise. Link outward instead of duplicating long prose.
- Preserve the distinction between stable memory and temporary working notes.
- Before starting any non-trivial implementation task, match the task to the closest skill in `ai/SKILLS.md` and load the corresponding `ai/skills/*.md` file. Do not begin editing files until the skill's workflow, decision rules, and completion criteria are loaded.
- After completing any non-trivial workflow, ask whether the work introduced durable learnings that should update `ai/MEMORY.md`, `ai/SKILLS.md`, a specific `ai/skills/*.md`, `AGENTS.md`, or a playbook under `ai/playbooks/` before considering the task fully closed.
- Treat repository settings changes as separate control-plane work. Do not use settings changes as the default fix path for an ordinary task or PR blocker.
- Do not merge a pull request in this repository until every configured merge gate on the current head SHA is complete and green. This rule still applies if GitHub branch protection is missing or misconfigured.
- When you are the agent executing the PR loop for a change you published, **you are responsible for finishing the loop**: after gates are green and CodeRabbit threads are accounted for per `ai/playbooks/pull-request-execution-loop.md`, **merge** (or confirm the configured merge queue has merged) unless policy requires a human decision. Prefer a single verification pass when the operator says checks finished, instead of unbounded polling.
- Configured AI review (CodeRabbit) is a **soft-mandatory** gate for substance, not only for a green status. Before merge, **every** open review thread **MUST** be closed with a code fix or a **visible** decision using the canonical outcomes in `.coderabbit.yaml` (**fix**, **accept as follow-up**, **won't change**). Full mappings, per-thread vs consolidated comments, GitHub thread-state rules, nit handling, and waiver requirements are normative in `ai/playbooks/pull-request-execution-loop.md` (finding closure before merge + §1.5)—do not resolve threads solely to clear “conversations resolved” without that accounting.
- When addressing CodeRabbit findings, prefer replying directly in the review thread with the resolution details so the history stays attached to the finding itself.
- Do not use admin merge, temporary removal of required checks, or other host bypasses to skip that review accounting unless the human operator has **explicitly** instructed you to use a documented control-plane exception (for example merging a workflow change that updates `p1-policy` itself).
- Wait for CodeRabbit's automatic review run by default. If no CodeRabbit comment or status appears after roughly 15 seconds on a new head SHA, you may post `@coderabbitai review` without asking. If CodeRabbit has already posted a "review in progress" style comment or otherwise clearly started, poll for up to 5 minutes in 1-minute intervals and then ask the user before posting a manual `@coderabbitai review` recovery comment. A green reviewer check does not prove a new **submitted** review replaced an older **`CHANGES_REQUESTED`**.
- When every thread has a visible outcome on the **current** head but **`CHANGES_REQUESTED`** persists, or threads still need CodeRabbit to acknowledge closure, post **one** PR comment with the **canonical approval prompt** from `ai/playbooks/pull-request-execution-loop.md` section 3 item 6. **Do not** use `@coderabbitai review` for that—it forces a long full re-review. See `ai/skills/developer.md` step 9.
- **Stale reviews / merge queue:** When thread closure on the **current** head is complete but GitHub still shows **`CHANGES_REQUESTED`** only from **older** bot submissions, a **maintainer** may **dismiss** those stale reviews with a **visible message** (normative rules: `ai/playbooks/pull-request-execution-loop.md`, finding closure)—not a bypass for open findings. If **Mergify** dropped the PR, re-queue with `@mergifyio queue` and the queue name from `.mergify.yml` (e.g. `low-risk`); remove a stray **`dequeued`** label if it blocks a clean retry.
- When publishing changes with a pull request in this repository, open the PR ready for review by default. Use a draft PR only when the user explicitly asks for draft state.
- **Branch model:** feature branches target `staging`, not `main`. `staging` is the integration branch, protected with the same rules as `main`. The `staging` → `main` promotion is automated by release-please using a regular merge (not squash) to preserve conventional commit history; no separate review is required when CI is green. Never open a feature PR directly against `main` unless it is a release-please release PR.

## Change Discipline

- When adding a new recurring workflow, update `ai/PLAYBOOKS.md`, `ai/playbooks/` as needed, `ai/SKILLS.md`, and any corresponding `ai/skills/*.md` files.
- When changing repo operating rules, check whether `AGENTS.md` and `ai/MEMORY.md` now need updates.
- When introducing durable process knowledge, prefer a playbook under `ai/playbooks/` or a schema-backed artifact over burying it in memory.
- Do not treat transient chat as the system of record.

## Escalation Conditions

Escalate or stop when any of these are true:

- the task would contradict schema, policy, or playbook rules
- a high-stakes governance decision is required
- repository intent is ambiguous and cannot be resolved from the tracked artifacts
- a change would grant new authority to automation without explicit policy support

## Important Paths

- `spec/schema/` - canonical machine validation rules
- `spec/examples/` - validated product and slice examples
- `spec/policy/` - event and governance policy
- `interfaces/interfaces.yaml` - logical tool interfaces for agent workflows
- `docs/AI_NATIVE_FRAMEWORK.md` - normative framework prose
- `ai/PLAYBOOKS.md` - playbook discovery index (procedures live in `ai/playbooks/`)
- `ai/playbooks/repository-foundation.md` - governed repository baseline (CI, protection, contributor surfaces)
- `ai/playbooks/pull-request-execution-loop.md` - pull request automation and merge policy
- `ai/playbooks/agent-context-bundle.md` - how to install and maintain the `ai/` bundle alongside root `AGENTS.md`
- `ai/playbooks/framework-review.md` - how to audit the framework itself for consistency, efficiency, and predictability
- `ai/playbooks/release-management.md` - how to automate repository-level tags and GitHub Releases with a governed release PR flow
- `ai/playbooks/resolve-github-issues.md` - how to batch and resolve open GitHub issues with per-issue audit comments and one PR per fix group
- `ai/playbooks/resolve-sentry-issues.md` - how to manage Sentry issues as governed incidents with assignment, notes, and evidence-based closure
- `ai/playbooks/environment-separation.md` - how to establish and maintain the 3-tier environment model (production / staging / development) including branch setup, Vercel configuration, and analytics token scoping
- `ai/SKILLS.md` - skill discovery index (role- and task-oriented harnesses)
- `ai/skills/` - on-demand skill bodies selected from `ai/SKILLS.md`
- `ai/MEMORY.md` - durable operating memory and open loops

## Definition Of Done

A framework change is not complete if it leaves the agent bundle under `ai/` stale. If your edit changes how an agent should bootstrap, choose a skill or playbook, validate work, or preserve context, update `AGENTS.md`, `ai/PLAYBOOKS.md`, `ai/SKILLS.md`, `ai/skills/`, `ai/playbooks/`, or `ai/MEMORY.md` in the same change as appropriate.
