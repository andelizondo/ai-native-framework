# AGENTS.md

## Purpose

This repository defines an AI-native operating framework for product-led companies. The canonical system lives in schema, policy, interfaces, and playbooks. Markdown at the repo root exists to help agents bootstrap accurately and act consistently inside that system.

## Read Order

Read these in order before making non-trivial changes:

1. `README.md`
2. `docs/AI_NATIVE_FRAMEWORK_COMPLETE.md`
3. `docs/PLAYBOOKS.md`
4. The specific playbook or spec files relevant to the task
5. `SKILLS.md`
6. `MEMORY.md`

## Authority Ladder

Higher items override lower items:

1. `spec/schema/*`
2. Validated artifacts under `spec/examples/*` and future `spec/processes/*`
3. `spec/policy/*`
4. `agents/interfaces.yaml`
5. Playbooks under `docs/*`
6. `AGENTS.md`, `SKILLS.md`, `MEMORY.md`

If two sources conflict, follow the higher source and update the lower one if that is within scope.

## Canonical Commands

- Install: `npm install`
- Validate framework artifacts: `npm run validate`

If you change schema, examples, policy, templates, or playbooks, run `npm run validate` before concluding work.

## Working Rules

- Keep the framework provider-agnostic. Do not encode a single model vendor or IDE as core policy.
- Treat specs, policy, and playbooks as the durable operating system. Root markdown files are bootstrap aids, not a replacement for canonical artifacts.
- Prefer updating the framework and playbooks together when a process change affects repository behavior.
- Keep repository-local agent instructions concise. Link outward instead of duplicating long prose.
- Preserve the distinction between stable memory and temporary working notes.
- Do not merge a pull request in this repository until every configured merge gate on the current head SHA is complete and green. This rule still applies if GitHub branch protection is missing or misconfigured.
- When publishing changes with a pull request in this repository, open the PR ready for review by default. Use a draft PR only when the user explicitly asks for draft state.

## Change Discipline

- When adding a new recurring workflow, update `docs/PLAYBOOKS.md` and `SKILLS.md`.
- When changing repo operating rules, check whether `AGENTS.md` and `MEMORY.md` now need updates.
- When introducing durable process knowledge, prefer a playbook or schema-backed artifact over burying it in memory.
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
- `docs/AI_NATIVE_FRAMEWORK_COMPLETE.md` - normative framework prose
- `docs/PLAYBOOKS.md` - playbook index
- `docs/P0_REPOSITORY_FOUNDATION.md` - repository bootstrap
- `docs/P1_PR_EXECUTION_LOOP.md` - PR automation policy
- `docs/P2_AGENT_CONTEXT_BUNDLE.md` - agent runtime bundle standard

## Definition Of Done

A framework change is not complete if it leaves the runtime bundle stale. If your edit changes how an agent should bootstrap, choose a skill, validate work, or preserve context, update this bundle in the same change.
