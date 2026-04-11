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
4. `agents/interfaces.yaml`
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
- Configured AI review (CodeRabbit) is a **soft-mandatory** gate for substance, not only for a green status. Before merge, **every** open review thread **MUST** be closed with a code fix or a **visible** decision using the canonical outcomes in `.coderabbit.yaml` (**fix**, **accept as follow-up**, **won't change**). Full mappings, per-thread vs consolidated comments, GitHub thread-state rules, nit handling, and waiver requirements are normative in `ai/playbooks/pull-request-execution-loop.md` (finding closure before merge + §1.5)—do not resolve threads solely to clear “conversations resolved” without that accounting.
- When addressing CodeRabbit findings, prefer replying directly in the review thread with the resolution details so the history stays attached to the finding itself.
- Do not use admin merge, temporary removal of required checks, or other host bypasses to skip that review accounting unless the human operator has **explicitly** instructed you to use a documented control-plane exception (for example merging a workflow change that updates `p1-policy` itself).
- Wait for CodeRabbit's automatic review run by default. If no CodeRabbit comment or status appears after roughly 15 seconds on a new head SHA, you may post `@coderabbitai review` without asking. If CodeRabbit has already posted a "review in progress" style comment or otherwise clearly started, poll for up to 5 minutes in 1-minute intervals and then ask the user before posting a manual `@coderabbitai review` recovery comment.
- When publishing changes with a pull request in this repository, open the PR ready for review by default. Use a draft PR only when the user explicitly asks for draft state.

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
- `agents/interfaces.yaml` - logical tool interfaces for agent workflows
- `docs/AI_NATIVE_FRAMEWORK.md` - normative framework prose
- `ai/PLAYBOOKS.md` - playbook discovery index (procedures live in `ai/playbooks/`)
- `ai/playbooks/repository-foundation.md` - governed repository baseline (CI, protection, contributor surfaces)
- `ai/playbooks/pull-request-execution-loop.md` - pull request automation and merge policy
- `ai/playbooks/agent-context-bundle.md` - how to install and maintain the `ai/` bundle alongside root `AGENTS.md`
- `ai/SKILLS.md` - skill discovery index (role- and task-oriented harnesses)
- `ai/skills/` - on-demand skill bodies selected from `ai/SKILLS.md`
- `ai/MEMORY.md` - durable operating memory and open loops

## Definition Of Done

A framework change is not complete if it leaves the agent bundle under `ai/` stale. If your edit changes how an agent should bootstrap, choose a skill or playbook, validate work, or preserve context, update `AGENTS.md`, `ai/PLAYBOOKS.md`, `ai/SKILLS.md`, `ai/skills/`, `ai/playbooks/`, or `ai/MEMORY.md` in the same change as appropriate.
