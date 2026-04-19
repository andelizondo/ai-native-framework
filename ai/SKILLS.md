# SKILLS.md

This file is the skill discovery index for the repository-local agent bundle under **`ai/`** (root `AGENTS.md` is the only agent file outside this folder). Read it to decide which skill to load, then open only the specific `skills/*.md` file next to this index or a playbook under `playbooks/` for the current task. For playbook routing alone, you may start from `PLAYBOOKS.md` in this directory instead.

## How To Use This File

1. Match the task to the closest skill or playbook entry below.
2. Open only the linked skill file or canonical source for the selected entry.
3. Load deeper references only when the selected skill says they are needed.
4. If no entry fits, work conservatively and consider whether the workflow deserves a new skill after the task is complete.

Discovery should stay broad and cheap. Execution should stay narrow and deep.

## Skill Index

### Framework Bootstrap

- **When to use:** orienting a new agent or starting substantial work in this repository
- **Inputs:** repository purpose, current task, affected files
- **Outputs:** correct read order, authority map, and validation plan
- **Load:** `AGENTS.md`, `README.md`, `docs/AI_NATIVE_FRAMEWORK.md`, `PLAYBOOKS.md` (in this directory)
- **Notes:** use this before making policy, playbook, or workflow changes

### Designer

- **When to use:** creating or refining visual assets, brand elements, and design directions
- **Inputs:** goal, brand intent, target surface, references, human feedback
- **Outputs:** concrete design directions, selected asset, implementation-ready handoff
- **Load:** `skills/designer.md`

### PM

- **When to use:** shaping a requested change into scope, rationale, acceptance criteria, and implementation guidance
- **Inputs:** goal, constraints, selected concept, affected surfaces
- **Outputs:** concise change brief, scope, non-goals, acceptance criteria
- **Load:** `skills/pm.md`

### Developer

- **When to use:** implementing repository changes and carrying them through validation, PR review, and merge per the pull request execution playbook
- **Inputs:** approved scope, affected files, repository constraints, live PR state
- **Outputs:** implementation, verification evidence, review closure, published PR state
- **Load:** `skills/developer.md`

### Feature implementation (dashboard product)

- **When to use:** implementing a new feature in `products/dashboard/` from a completed `templates/feature-request.md`
- **Inputs:** completed feature request, current spec YAML, current `AnalyticsEvent` type registry
- **Outputs:** updated spec, updated type registry, wired component(s), passing validation, PR
- **Load:** `playbooks/feature-implementation.md`
- **Constraints:** spec-first; events required before code; `npm run validate` before PR

### Framework Keeper

- **When to use:** auditing the framework itself for contradiction, duplication, unnecessary complexity, or underspecified decision paths
- **Inputs:** audit scope, relevant authoritative artifacts, known operator pain points, recent framework changes
- **Outputs:** structured findings, recommended remediations, and explicit decisions on what should remain unchanged
- **Load:** `skills/framework-keeper.md`

### Repository foundation (playbook)

- **When to use:** establishing or auditing repository governance, CI, branch protection, security defaults, and contributor surfaces
- **Inputs:** repository owner, default branch, canonical validation command, maintainer identity
- **Outputs:** governed repo baseline and recorded settings
- **Load:** `playbooks/repository-foundation.md`
- **Constraints:** do not guess required check names; read real emitted checks

### Pull request execution loop (playbook)

- **When to use:** designing, implementing, or reviewing PR automation, risk policy, branch freshness, or merge authority behavior
- **Inputs:** PR metadata, labels, required checks, review state, branch freshness state, threshold policy
- **Outputs:** residual-risk decision, merge authority, or structured escalation request
- **Load:** `playbooks/pull-request-execution-loop.md`
- **Constraints:** machines verify, humans decide; do not convert timing gaps into human-review work

### Release management (playbook)

- **When to use:** enabling or revising repository-level releases, semantic version tags, release PR behavior, or GitHub Release notes.
- **Inputs:** release branch, version baseline, token strategy, and merge policy.
- **Outputs:** release workflow, changelog/version config, and documented operator setup.
- **Load:** `playbooks/release-management.md`
- **Constraints:** release the whole repository, not `products/dashboard/` alone; prefer dedicated automation credentials over `GITHUB_TOKEN`

### Publish to production (playbook)

- **When to use:** promoting reviewed changes from `staging` to `main`, publishing to production, or answering how a PR to `main` should work in this repository.
- **Inputs:** current `staging` and `main` SHAs, promotion PR state, queue state, and release automation state.
- **Outputs:** open or merged `staging` -> `main` promotion PR and post-merge release verification evidence.
- **Load:** `playbooks/publish-to-production.md`
- **Constraints:** feature PRs still target `staging`; `staging` -> `main` must use a regular merge commit and the promotion-specific gate

### Agent context bundle (playbook)

- **When to use:** creating or updating root `AGENTS.md`, or files under `ai/` (`SKILLS.md`, `skills/*.md`, `MEMORY.md`, `PLAYBOOKS.md`, `playbooks/`), or making agent bootstrap behavior explicit in a repository
- **Inputs:** authority ladder, canonical commands, playbooks, glossary, durable facts, open loops
- **Outputs:** maintained agent runtime bundle (`AGENTS.md` + `ai/`)
- **Load:** `playbooks/agent-context-bundle.md`
- **Constraints:** keep the bundle concise, index-shaped inside `ai/`, and subordinate to schema and policy

### Quality Engineer

- **When to use:** writing or reviewing tests, triaging `test` or `e2e` CI failures, executing the incident-to-regression loop, auditing phase readiness, or setting up the test stack for a new product
- **Inputs:** spec entry or incident ID, current test suite state, phase level, failing check output or Playwright report
- **Outputs:** tests at the correct layer, passing `test` and `e2e` gates, regression coverage, phase evidence bundle
- **Load:** `skills/quality-engineer.md`
- **Notes:** for operational procedures (PR gate loop, nightly triage, incident closure), also load `playbooks/quality-standard-execution.md`.

### Resolve GitHub issues (playbook)

- **When to use:** triaging and resolving open GitHub issues, especially when several issues appear to share the same workflow failure, file, or root cause
- **Inputs:** open issue set, issue metadata, workflow evidence, validation command, branch and PR policy
- **Outputs:** grouped issue plan, required issue comments, one fix PR per group, and explicit issue outcome updates
- **Load:** `playbooks/resolve-github-issues.md`
- **Constraints:** comment intent on every issue before editing; batch only when one fix really serves the same root cause

### Resolve Sentry issues (playbook)

- **When to use:** triaging and resolving Sentry issues that need assignment, incident notes, linked PR tracking, and evidence-based closure
- **Inputs:** Sentry issue metadata, write-capable token, linked PR, recent events, releases, and merge timing
- **Outputs:** assigned issue, triage note, resolution note, and final `resolved` or continued `unresolved` state
- **Load:** `playbooks/resolve-sentry-issues.md`
- **Constraints:** do not resolve from intuition; use merge time, `lastSeen`, and recent events/releases to justify closure

### Service wiring (playbook)

- **When to use:** configuring Supabase auth, Vercel environment variables, or OAuth providers for a new or existing deployment environment; or debugging auth failures that originate from external service misconfiguration rather than code
- **Inputs:** target domain, auth providers to enable, Supabase project ref, Vercel project details
- **Outputs:** correct Supabase URL config and provider settings, aligned env vars in `.env.local` and Vercel, working auth flow
- **Load:** `playbooks/service-wiring.md`
- **Constraints:** Supabase auth config and Vercel env vars require dashboard steps — no MCP tool covers them; the playbook's tooling coverage map lists exactly what is and is not automatable

### Spec Evolution

- **When to use:** changing framework structure, required fields, or examples under `spec/`
- **Inputs:** desired behavioral change, schema updates, example updates, policy impact
- **Outputs:** aligned schema, examples, and documentation
- **Load:** `spec/schema/product-spec.schema.json`, `spec/examples/`, `docs/AI_NATIVE_FRAMEWORK.md`
- **Constraints:** avoid spec theater; machine validation is the source of truth

### Interface Evolution

- **When to use:** changing logical tool contracts or capability boundaries
- **Inputs:** workflow need, capability boundary, interface change rationale
- **Outputs:** updated `interfaces/interfaces.yaml` and aligned docs
- **Load:** `interfaces/interfaces.yaml`, `docs/AI_NATIVE_FRAMEWORK.md`
- **Constraints:** express capabilities, not mascots or vendor-specific personas

## Adding A New Skill

Add a new `ai/skills/*.md` file when all of these are true:

- the workflow recurs
- the workflow has a stable trigger
- the workflow benefits from a reusable operating harness
- loading the skill only when needed will save ambiguity or token cost

For each new skill:

- keep `ai/SKILLS.md` as the discovery pointer, not the full body
- make the skill file operational and concise
- include triggers, inputs, outputs, workflow steps, decision rules, escalations, and completion criteria
- point to the canonical docs or playbooks the skill relies on
