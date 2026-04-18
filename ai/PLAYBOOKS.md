# PLAYBOOKS.md

This file is the playbook discovery index for this repository. It lives under **`ai/`** next to `SKILLS.md` and the `playbooks/` subdirectory. Read it to decide which procedure applies, then open only the linked file under `playbooks/`. Agents also see matching entries in `ai/SKILLS.md` for routing; this file is the canonical inventory of procedure playbooks.

Each playbook is **atomic**: it states its own objective, inputs, outputs, and constraints. You can open any one of them when that topic is what you need.

## How To Use This File

1. Match the situation to the closest playbook entry below.
2. Open only the linked playbook under `playbooks/` for the selected entry.
3. Follow cross-references inside that playbook when they point at schema, policy, or tooling.
4. If no entry fits, treat the gap as a signal to extend the framework or add a new playbook after the task is complete.

Discovery should stay broad and cheap. Execution should stay narrow and deep.

## Suggested Bootstrap Order (Not Part Of Playbook Identity)

When you are **standing up a new framework-aligned repository**, work usually flows:

1. Establish a governed baseline (repository foundation) so CI, checks, and protection are real.
2. Layer pull request automation on top of that baseline.
3. Add or refresh the material under `ai/` (this index, skills, playbooks, memory) when agents will participate repeatedly.

That sequence is **practical**, not a ranking of importance: mature repos often touch only one playbook at a time.

## Relationship To `SKILLS.md`

- **`ai/SKILLS.md`** routes agents to the right *next file* (skills, playbooks, or spec surfaces).
- **`PLAYBOOKS.md`** (this file) lists every procedure playbook and what each one is responsible for; bodies live in `playbooks/*.md` relative to `ai/`, the same way skill bodies live in `skills/*.md` relative to `ai/`.
- When you add or retire a playbook, update this file and align `SKILLS.md` in this directory (and root `AGENTS.md` if the important-paths map changes).

## Playbook Index

### Repository foundation

- **When to use:** creating a new repository, or auditing or repairing governance, CI, branch protection, security defaults, and contributor surfaces.
- **Inputs:** repository name and owner; default branch; at least one passing validation workflow; maintainer handle for CODEOWNERS.
- **Outputs:** governed execution surface with CI, protection aligned to real checks, merge defaults, governance files, and dependency or security automation as described in the playbook.
- **Load:** [`playbooks/repository-foundation.md`](playbooks/repository-foundation.md)
- **Constraints:** do not guess required check names; read checks the host actually emits.

### Pull request execution loop

- **When to use:** every pull request targeting a protected branch; or when designing, implementing, or reviewing PR automation, risk policy, branch freshness, or merge authority.
- **Inputs:** PR metadata, diff, labels, required checks, CODEOWNERS, threshold policy, reviewer configuration, freshness policy, and policy decision mapping residual risk to merge authority.
- **Outputs:** risk classification, residual-risk decision, freshness decision, validation and review evidence, and a recorded decision path (approve, escalate, request changes, or merge when allowed).
- **Load:** [`playbooks/pull-request-execution-loop.md`](playbooks/pull-request-execution-loop.md)
- **Constraints:** machines verify, humans decide; treat the AI reviewer and merge executor as replaceable implementations behind policy. Configured workflows in this repository use a `p1-*` / `P1_*` naming prefix for traceability; that prefix refers to this playbook, not to an ordering label.

### Agent context bundle

- **When to use:** installing or maintaining the agent bundle: root `AGENTS.md`, plus `SKILLS.md`, optional `skills/`, and `MEMORY.md` under `ai/`, whenever bootstrap behavior or the authority ladder changes.
- **Inputs:** repository purpose; authority ladder; canonical commands; playbook inventory; glossary and architecture facts; durable memory and open loops.
- **Outputs:** concise root `AGENTS.md`, an index-shaped `ai/SKILLS.md`, optional `ai/skills/*.md` bodies, maintained `ai/MEMORY.md`, and links from README or framework docs into `ai/`.
- **Load:** [`playbooks/agent-context-bundle.md`](playbooks/agent-context-bundle.md)
- **Constraints:** keep the bundle subordinate to schema and policy; do not duplicate full playbooks inside the root index files.

### Framework review

- **When to use:** auditing the framework itself for contradiction, duplication, unnecessary complexity, or missing decision rules.
- **Inputs:** audit scope, authoritative sources in ladder order, recent framework changes, and known friction points.
- **Outputs:** structured findings, remediation recommendations, and explicit keep-as-is decisions for stable areas.
- **Load:** [`playbooks/framework-review.md`](playbooks/framework-review.md)
- **Constraints:** audit the framework, not ordinary feature code; follow the authority ladder and do not weaken higher-order artifacts to satisfy lower-order drift.

### Feature implementation (dashboard)

- **When to use:** implementing any new feature in `products/dashboard/` from a completed feature request.
- **Inputs:** completed `templates/feature-request.md`; current `spec/examples/dashboard-product.yaml`; current `products/dashboard/lib/analytics/events.ts`.
- **Outputs:** updated spec YAML, updated `AnalyticsEvent` type registry, feature component(s), dual-pipeline analytics wiring (PostHog + internal audit), passing `npm run validate`.
- **Load:** [`playbooks/feature-implementation.md`](playbooks/feature-implementation.md)
- **Constraints:** spec update and type registry entry are required before any component code; `npm run validate` must pass before the PR ships; `posthog-js` may only be imported in the approved files listed in `docs/ANALYTICS_STANDARD.md` §3 — feature code must use `useAnalytics()` from `lib/analytics/events`.

### Release management

- **When to use:** enabling or changing repository-level release automation, tags, changelog generation, or GitHub Release behavior.
- **Inputs:** release branch, release strategy, current version baseline, token configuration, and merge policy.
- **Outputs:** governed release workflow, repo-level SemVer tags, release PRs, and GitHub Releases.
- **Load:** [`playbooks/release-management.md`](playbooks/release-management.md)
- **Constraints:** release the repository as a single unit; use a dedicated automation token when downstream workflows must trigger; route changes through the normal PR loop.

### Quality standard execution

- **When to use:** PR gate failures, nightly CI triage, incident-to-regression loop, phase readiness audit.
- **Inputs:** current phase, blocking gate state (check names and statuses), incident ID, eval results.
- **Outputs:** all blocking gates green; regression test merged and incident closed; phase readiness evidence bundle.
- **Load:** [`playbooks/quality-standard-execution.md`](playbooks/quality-standard-execution.md)
- **Constraints:** follow the merge-gate model in `docs/QUALITY_STANDARD.md §6`; do not advance phase without checking off the required list; accessibility violations on critical flows are non-deferrable.

### Service wiring

- **When to use:** configuring external services (Supabase auth, Vercel env vars, OAuth providers) for a new environment, or debugging auth failures caused by misconfigured redirect URLs or missing env vars.
- **Inputs:** target environment domain, list of auth providers to enable, Supabase project ref, Vercel project and team IDs.
- **Outputs:** Supabase auth configured (Site URL, Redirect URLs, email confirmation toggle), environment variables set in `.env.local` and Vercel, provider list consistent across code and dashboard.
- **Load:** [`playbooks/service-wiring.md`](playbooks/service-wiring.md)
- **Constraints:** Supabase auth config and Vercel env vars cannot be updated via MCP or code — both require dashboard steps documented in the playbook. Do not search for tools that do not exist; go directly to the dashboard.

---

## Adding A New Playbook

Add a new playbook document under `ai/playbooks/` when all of these are true:

- the procedure recurs or governs a long-lived loop
- the trigger and outcomes are stable enough to version in prose
- the workflow is not already better expressed as a single `ai/skills/*.md` harness

Prefer filenames `{kebab-case-slug}.md` (for example `repository-foundation.md`) so the topic reads clearly; the `playbooks/` directory under `ai/` already namespaces them. Do not encode ordering in the filename unless the repository has an explicit, stable sequence contract.

For each new playbook:

- add a row to this index with when to use, inputs, outputs, load path, and constraints
- add or adjust a matching entry in `ai/SKILLS.md` when agents should route to it
- update `docs/AI_NATIVE_FRAMEWORK.md` or `README.md` when the framework’s human-facing map should show the new procedure
