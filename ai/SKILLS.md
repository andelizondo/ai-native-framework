# SKILLS.md

Skill discovery index. Choose one skill or routed playbook, then open only that file.

## Use

1. Match the task to the closest entry.
2. Open only the linked skill or playbook.
3. Load deeper references only when that file requires them.
4. If nothing fits, work conservatively and consider whether the framework needs a new skill.

## Index

### Framework Bootstrap

- When to use: orient a new agent before substantial work
- Inputs: repo purpose, task, affected files
- Outputs: read path, authority map, validation plan
- Load: `AGENTS.md`, `README.md`, `PLAYBOOKS.md`
- Constraints: open `docs/AI_NATIVE_FRAMEWORK.md` only when the task explicitly needs The Framework

### Designer

- When to use: create or refine visual assets and design directions
- Inputs: goal, target surface, references, feedback
- Outputs: selected direction or asset-ready handoff
- Load: `skills/designer.md`
- Constraints: visual exploration, not implementation

### PM

- When to use: turn intent into scope, rationale, and acceptance criteria
- Inputs: goal, constraints, selected concept, affected surfaces
- Outputs: concise brief, scope, non-goals, acceptance criteria
- Load: `skills/pm.md`
- Constraints: do not invent PM work when scope is already clear

### Developer

- When to use: implement repo changes and carry them through validation, review, and merge
- Inputs: approved scope, affected files, repo constraints, live PR state
- Outputs: implementation, verification evidence, merged PR or explicit escalation
- Load: `skills/developer.md`
- Constraints: the executing agent owns convergence through merge when policy allows it

### Framework Keeper

- When to use: audit the framework for contradiction, duplication, ambiguity, or drag
- Inputs: audit scope, authoritative artifacts, recent changes, pain points
- Outputs: findings, remediations, and no-change decisions
- Load: `skills/framework-keeper.md`
- Constraints: framework work only

### Quality Engineer

- When to use: write or review tests, triage `test`/`e2e` failures, run incident-to-regression work, audit phase readiness
- Inputs: spec entry or incident ID, suite state, phase, failing output
- Outputs: correct-layer tests, green gates, regression coverage, or phase evidence
- Load: `skills/quality-engineer.md`
- Constraints: follow `docs/QUALITY_STANDARD.md`; for operational loops also load `playbooks/quality-standard-execution.md`

### Feature implementation (dashboard)

- When to use: implement a dashboard feature from a completed feature request
- Inputs: feature request, spec YAML, analytics event registry
- Outputs: updated spec, registry, implementation, validation evidence
- Load: `playbooks/feature-implementation.md`
- Constraints: spec first; events required before code

### Repository foundation

- When to use: establish or audit repo governance, CI, protection, and contributor surfaces
- Inputs: repo owner, default branch, validation command, maintainer identity
- Outputs: governed repo baseline
- Load: `playbooks/repository-foundation.md`
- Constraints: use real emitted checks

### Pull request execution loop

- When to use: PR automation, risk policy, freshness, review closure, or merge authority work
- Inputs: PR metadata, labels, checks, review state, threshold policy
- Outputs: residual-risk decision, merge path, or escalation request
- Load: `playbooks/pull-request-execution-loop.md`
- Constraints: machines verify, humans decide

### Qodo PR Resolver

- When to use: a high-risk PR has been reviewed by Qodo Code Review and findings need to be resolved before the human decision request
- Inputs: open PR with Qodo review comments, current branch
- Outputs: applied fixes, replies to each Qodo finding, pushed commit
- Load: invoke via the built-in `qodo-pr-resolver` skill (Skill tool)
- Constraints: run only after Qodo has finished its review (skill will poll if still in progress); only invoke for PRs requiring human decisions

### Release management

- When to use: enable or revise repo-level releases, tags, changelogs, or GitHub Releases
- Inputs: release branch, version baseline, token strategy, merge policy
- Outputs: release workflow, config, and operator setup
- Load: `playbooks/release-management.md`
- Constraints: release the whole repo, not one subpackage

### Publish to production

- When to use: promote reviewed changes from `staging` to `main`
- Inputs: `staging` and `main` SHAs, promotion PR state, queue state, release state
- Outputs: open or merged promotion PR and release verification
- Load: `playbooks/publish-to-production.md`
- Constraints: feature PRs still target `staging`

### Agent context bundle

- When to use: create or update `AGENTS.md` or files under `ai/`
- Inputs: authority ladder, commands, inventories, durable facts, open loops
- Outputs: maintained agent runtime bundle
- Load: `playbooks/agent-context-bundle.md`
- Constraints: keep the bundle concise and index-shaped

### Resolve GitHub issues

- When to use: triage and resolve open GitHub issues, especially shared-failure batches
- Inputs: issue set, workflow evidence, validation command, PR policy
- Outputs: grouped plan, issue comments, fix PR, explicit issue outcomes
- Load: `playbooks/resolve-github-issues.md`
- Constraints: batch only on real shared root cause

### Resolve Sentry issues

- When to use: triage and resolve Sentry issues with assignment and evidence-based closure
- Inputs: Sentry issue metadata, linked PR, events, releases, merge timing
- Outputs: triage note, resolution note, final issue state
- Load: `playbooks/resolve-sentry-issues.md`
- Constraints: do not resolve on intuition

### Service wiring

- When to use: configure deployment-service auth and env surfaces or debug service-side misconfiguration
- Inputs: target domain, auth providers, Supabase ref, Vercel project details
- Outputs: aligned dashboard config and env vars
- Load: `playbooks/service-wiring.md`
- Constraints: respect tooling coverage boundaries

### Spec Evolution

- When to use: change framework structure, schema requirements, or examples under `spec/`
- Inputs: desired behavior change, schema updates, example updates, policy impact
- Outputs: aligned schema, examples, and docs
- Load: `spec/schema/product-spec.schema.json`, `spec/examples/`, `docs/AI_NATIVE_FRAMEWORK.md`
- Constraints: machine validation is the source of truth

### Interface Evolution

- When to use: change logical tool contracts or capability boundaries
- Inputs: workflow need, boundary, rationale
- Outputs: updated `interfaces/interfaces.yaml` and aligned docs
- Load: `interfaces/interfaces.yaml`, `docs/AI_NATIVE_FRAMEWORK.md`
- Constraints: express capabilities, not vendor-specific personas

## Maintenance

- Add a skill only for recurring work with a stable trigger.
- Keep this file index-shaped: when to use, inputs, outputs, load, constraints.
- Put the operating body in `ai/skills/*.md` or the relevant playbook.
