# AGENTS.md

## Purpose

This repository defines an AI-native operating framework for product-led companies. The durable operating system lives in `spec/`, `interfaces/`, and `ai/playbooks/`. Root `AGENTS.md` is the bootstrap surface; every other agent artifact lives under `ai/`.

## Core Idea

Keep these facts loaded by default:

- The framework is spec-driven, event-observable, human-governed, and provider-agnostic at the core.
- Schema, policy, interfaces, and playbooks are the durable system; `ai/` is routing, memory, and execution support.
- Agents execute within declared constraints; humans decide strategy, ambiguity, and high-stakes actions.
- Framework changes are incomplete if the agent bundle under `ai/` is left stale.

When you see The Framework, open `docs/AI_NATIVE_FRAMEWORK.md`.
The Framework is the repository's long-form conceptual and normative narrative for the AI-native operating model: what the system is, its core principles, the division of labor between agents and humans, the layered architecture, the workflow library, and how the framework fits across product, operations, and governance. Use it when the conversation is about framework meaning, first principles, terminology, or cross-cutting design intent rather than a specific playbook or implementation detail.

## Read Order

Read these before non-trivial work:

1. `README.md`
2. `ai/PLAYBOOKS.md`
3. The specific files under `ai/playbooks/` or `spec/` relevant to the task
4. `ai/SKILLS.md`
5. Only the specific `ai/skills/*.md` files selected from `ai/SKILLS.md`
6. `ai/MEMORY.md`

Open `docs/AI_NATIVE_FRAMEWORK.md` only when:

- the user references The Framework
- framework prose or first-principles interpretation is needed
- the lower-order artifacts do not answer the question

## Authority Ladder

Higher items override lower items:

1. `spec/schema/*`
2. Validated artifacts under `spec/examples/*` and future `spec/processes/*`
3. `spec/policy/*`
4. `interfaces/interfaces.yaml`
5. `ai/playbooks/*.md`
6. `docs/*`
7. `AGENTS.md`, `ai/PLAYBOOKS.md`, `ai/SKILLS.md`, `ai/skills/*.md`, `ai/MEMORY.md`

If two sources conflict, follow the higher source and update the lower one if that is within scope.

## Canonical Commands

- Install: `npm install`
- Validate framework artifacts: `npm run validate`

If you change schema, examples, policy, templates, or playbooks, run `npm run validate` before concluding work.

## Working Rules

- Keep the framework provider-agnostic. Do not encode one model vendor or IDE as core policy.
- Keep repository-local agent instructions concise. Prefer pointers over repeated prose.
- Think before coding: state material assumptions, surface ambiguity, and ask when uncertainty would change the implementation.
- If multiple valid interpretations or tradeoffs exist, make them explicit instead of choosing silently.
- Prefer the simplest solution that fully satisfies the request. Do not add speculative features, abstractions, configurability, or impossible-scenario handling.
- Make surgical changes: touch only what the task requires, match local style, and avoid opportunistic refactors or adjacent cleanup.
- Remove only the unused code your change creates; mention unrelated dead code without deleting it unless asked.
- Every changed line should trace directly to the user's request or to verification required by the change.
- Turn requests into verifiable goals before implementing. For multi-step work, define a short plan with a concrete verification check per step.
- Before non-trivial implementation, match the task to the closest entry in `ai/SKILLS.md` and load that skill.
- After non-trivial workflow completion, check whether `AGENTS.md`, `ai/MEMORY.md`, `ai/SKILLS.md`, `ai/PLAYBOOKS.md`, a skill, or a playbook now needs an update.
- Treat repository settings changes as separate control-plane work unless explicitly requested.
- Do not merge a PR until every configured merge gate on the current head SHA is complete and green.
- If you published the PR, you own the loop through merge when policy allows it.
- Configured AI review is selective: Qodo Code Review is only used for PRs where human intervention is required (`risk:high` / `residual:high` or `residual:med`).
- For high-risk PRs: post `/agentic_describe` and `/agentic_review` as PR comments to trigger Qodo review, then invoke the `qodo-pr-resolver` skill to resolve all findings before posting the human decision request.
- For low-risk PRs (`risk:low` or `risk:med` without `control-plane`): skip Qodo entirely — `p1-policy` sets `residual:low` directly and Mergify auto-merges.
- A maintainer may dismiss stale bot reviews only after current-head finding resolution is complete and the dismissal message is visible.
- Feature branches target `staging`, not `main`. The valid human-authored PR to `main` is the governed `staging` -> `main` promotion PR.
- Open PRs ready for review by default unless the user explicitly asks for draft.

## Change Discipline

- When adding a recurring workflow, update `ai/PLAYBOOKS.md`, the relevant file under `ai/playbooks/`, `ai/SKILLS.md`, and any matching skill files.
- When changing repo operating rules, check whether `AGENTS.md` and `ai/MEMORY.md` need updates.
- Prefer durable process knowledge in playbooks or schema-backed artifacts, not memory.
- Favor caution over speed on non-trivial work; use judgment on trivial tasks.
- Do not treat transient chat as the system of record.

## Escalation Conditions

Escalate or stop when:

- the task would contradict schema, policy, or playbook rules
- a high-stakes governance decision is required
- repository intent is ambiguous and cannot be resolved from tracked artifacts
- a change would grant new authority to automation without explicit policy support

## Important Paths

- `spec/schema/` - canonical machine validation rules
- `spec/examples/` - validated examples
- `spec/policy/` - event and governance policy
- `interfaces/interfaces.yaml` - logical tool interfaces
- `docs/AI_NATIVE_FRAMEWORK.md` - long-form framework prose; opened explicitly as The Framework
- `ai/PLAYBOOKS.md` - playbook discovery index
- `ai/playbooks/` - canonical procedure bodies
- `ai/SKILLS.md` - skill discovery index
- `ai/skills/` - on-demand skill bodies
- `ai/MEMORY.md` - durable repo memory and open loops

## Definition Of Done

A framework change is not complete if it leaves the `ai/` bundle stale. If your edit changes how agents bootstrap, choose skills or playbooks, validate work, or preserve context, update the relevant bundle files in the same change.
