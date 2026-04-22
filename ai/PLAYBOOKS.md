# PLAYBOOKS.md

Playbook discovery index. Choose the closest procedure, then open only that file under `ai/playbooks/`.

## Use

1. Match the task to one playbook.
2. Open only the linked file.
3. Follow higher-authority references from inside that playbook.
4. If nothing fits, finish the task conservatively and consider whether the framework needs a new playbook.

## Index

### Repository foundation

- When to use: create, audit, or repair repo governance, CI, protection, and contributor surfaces
- Inputs: repo owner/name, default branch, passing validation workflow, maintainer handle
- Outputs: governed repo baseline and recorded settings
- Load: `playbooks/repository-foundation.md`
- Constraints: bind required checks to real emitted check names

### Pull request execution loop

- When to use: any PR targeting a protected branch; PR automation, risk, review, freshness, or merge-policy work
- Inputs: PR metadata, labels, checks, review state, branch freshness, threshold policy
- Outputs: residual-risk decision, merge path, or escalation request
- Load: `playbooks/pull-request-execution-loop.md`
- Constraints: machines verify, humans decide

### Agent context bundle

- When to use: create or maintain root `AGENTS.md` and the `ai/` bundle
- Inputs: authority ladder, commands, playbook inventory, skill inventory, durable facts, open loops
- Outputs: maintained bootstrap bundle
- Load: `playbooks/agent-context-bundle.md`
- Constraints: keep bundle concise and subordinate to higher-order artifacts

### Framework review

- When to use: audit the framework for contradiction, duplication, ambiguity, or operating drag
- Inputs: audit scope, authoritative artifacts, recent changes, known pain points
- Outputs: findings, remediations, and explicit no-change calls
- Load: `playbooks/framework-review.md`
- Constraints: audit the framework, not ordinary feature code

### Feature implementation (dashboard)

- When to use: implement a dashboard feature from a completed feature request
- Inputs: feature request, current spec YAML, analytics event registry
- Outputs: updated spec, registry, implementation, validation evidence
- Load: `playbooks/feature-implementation.md`
- Constraints: spec first; events required before code

### Release management

- When to use: enable, change, or audit repo-level release automation
- Inputs: release branch, strategy, version baseline, token config, merge policy
- Outputs: release workflow, config, tags, GitHub Releases
- Load: `playbooks/release-management.md`
- Constraints: release the repository as one unit

### Publish to production

- When to use: publish reviewed `staging` work to production or answer how PRs to `main` work here
- Inputs: `staging` and `main` SHAs, promotion PR state, queue state, release automation state
- Outputs: open or merged `staging` -> `main` promotion PR and publish evidence
- Load: `playbooks/publish-to-production.md`
- Constraints: no feature PRs directly to `main`; promotion uses regular merge

### Quality standard execution

- When to use: PR gate failures, nightly triage, incident-to-regression work, phase-readiness audit
- Inputs: current phase, gate state, incident ID, eval or test results
- Outputs: green gates, regression coverage, or phase evidence bundle
- Load: `playbooks/quality-standard-execution.md`
- Constraints: follow `docs/QUALITY_STANDARD.md`; do not self-advance phase

### Resolve GitHub issues

- When to use: triage and fix open GitHub issues, especially grouped operational failures
- Inputs: issue set, workflow evidence, validation command, PR policy
- Outputs: grouped plan, pre-change comments, one PR per fix group, explicit issue updates
- Load: `playbooks/resolve-github-issues.md`
- Constraints: comment intent before editing; batch only when root cause is shared

### Resolve Sentry issues

- When to use: triage and close live Sentry incidents
- Inputs: org/project, issue ID, write token, linked PR, recent event data
- Outputs: assignment, triage note, evidence-based closure, resolution note
- Load: `playbooks/resolve-sentry-issues.md`
- Constraints: keep issue unresolved until post-merge evidence supports closure

### Environment separation

- When to use: establish or audit the 3-tier production/staging/development model
- Inputs: repo owner/name, production and staging domains, Vercel access, GitHub admin access
- Outputs: protected `staging`, staged CI targets, scoped observability env vars, environment docs
- Load: `playbooks/environment-separation.md`
- Constraints: never target production from nightly CI

### Service wiring

- When to use: configure Supabase auth, Vercel env vars, or OAuth providers; debug service-side auth misconfiguration
- Inputs: target domain, auth providers, Supabase project ref, Vercel project details
- Outputs: aligned dashboard config, env vars, and provider exposure
- Load: `playbooks/service-wiring.md`
- Constraints: dashboard-only steps stay dashboard-only

## Maintenance

- Add a playbook only for recurring, stable procedures.
- Keep this file index-shaped: when to use, inputs, outputs, load, constraints.
- Update `ai/SKILLS.md` and any relevant docs when the inventory changes.
