# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Agent Bootstrap — Read First

Before making any non-trivial changes, read in this order:

1. `AGENTS.md` — authority ladder, commands, merge and review rules (start here)
2. `README.md`
3. `docs/AI_NATIVE_FRAMEWORK.md`
4. `ai/PLAYBOOKS.md` → the specific playbook under `ai/playbooks/` relevant to the task
5. `ai/SKILLS.md` → only the specific `ai/skills/*.md` file selected from the index
6. `ai/MEMORY.md`

For implementation tasks, load `ai/skills/developer.md` before editing any product code.

## Commands

### Framework (repo root)

```bash
npm install          # install root deps
npm run validate     # validate spec/examples/ against spec/schema/ — run after any schema/policy/template change
```

### Dashboard (`products/dashboard/`)

```bash
npm run dev          # Next.js dev server on port 3000
npm run build        # production build
npm run lint         # Next.js linter
npm run test         # Vitest unit/component suite (single run)
npm run test:watch   # Vitest in watch mode
npm run test:coverage
npm run test:e2e     # Playwright E2E against a running server
npm run test:e2e:ui
npm run test:e2e:headed
```

Run a single Vitest test file: `cd products/dashboard && npx vitest <file-or-pattern>`

Run a single Playwright spec: `cd products/dashboard && npx playwright test <spec-file>`

## Repository Architecture

This repository is two things at once: the **framework** (schema, policy, interfaces, playbooks, agent surfaces) and a **reference product** (`products/dashboard`).

### Authority Ladder (higher overrides lower)

1. `spec/schema/` — machine-validated JSON Schema rules
2. `spec/examples/`, `spec/processes/` — validated instances
3. `spec/policy/` — event naming, PII, idempotency rules
4. `interfaces/interfaces.yaml` — provider-agnostic logical contracts
5. `ai/playbooks/` — unitary procedure bodies
6. `docs/` — framework prose
7. `AGENTS.md`, `ai/SKILLS.md`, `ai/skills/`, `ai/MEMORY.md` — bootstrap/routing

When two sources conflict, follow the higher source and update the lower one.

### Framework Layer (`spec/`, `interfaces/`, `ai/`, `docs/`)

- **`spec/schema/`** — JSON Schema for product/slice specs; AJV-validated via `npm run validate`
- **`spec/policy/event-taxonomy.yaml`** — event naming, PII, and idempotency rules; must stay aligned with runtime emitters in `products/dashboard/lib/analytics/`
- **`interfaces/interfaces.yaml`** — logical tool contracts for agents (read_spec, validate_spec, emit_event, etc.); deliberately provider-agnostic
- **`ai/`** — agent runtime bundle: `PLAYBOOKS.md` (index), `playbooks/` (procedures), `SKILLS.md` (index), `skills/` (role bodies), `MEMORY.md` (durable facts)
- **`docs/ANALYTICS_STANDARD.md`** and **`docs/QUALITY_STANDARD.md`** — first-class governed standards; do not collapse them

### Dashboard Product (`products/dashboard/`)

Next.js 15 / React 19 application with:

- **`app/`** — Next.js App Router pages and layouts
- **`components/`** — React UI components
- **`lib/auth/`** — auth boundary; all provider-specific Supabase calls belong here only
- **`lib/analytics/`** — PostHog + internal event audit; identity lifecycle wired through `lib/analytics/identity.ts`
- **`lib/monitoring/`** — Sentry integration; sign-in/out must clear monitoring identity state
- Supabase (PostgreSQL) for persistence; one project per environment (`<product>-staging`, `<product>-production`)

Sentry is expected for every product feature (frontend and backend). See `ai/skills/developer.md` for required Sentry surface per feature type.

## Branch Model and PR Workflow

- Feature branches target `staging`, never `main`
- `staging` is a protected integration branch with the same rules as `main`
- `staging` → `main` is automated by release-please (regular merge, not squash) — never open a feature PR directly to `main`
- After each release, `main` is back-merged into `staging` via `.github/workflows/back-merge-to-staging.yml`

**Merge gates** (all must be green): `validate`, `test`, `e2e`, `decide`, `migrate-validate`

**CodeRabbit** is soft-mandatory. Every review thread must be closed with a code fix or a visible decision (`fix` / `accept as follow-up` / `won't change`) before merge. Reply directly on each thread; do not silently resolve. See `ai/playbooks/pull-request-execution-loop.md` for the full closure protocol.

**Mergify** handles automatic merge for `staging-integration` (feature→staging) and `staging-promotion` (staging→main) queues. If a PR is dequeued, remove the `dequeued` label and re-queue with `@mergifyio queue <queue-name>`.

## Testing Conventions

- Unit/component tests: Vitest + React Testing Library + MSW (jsdom environment)
- E2E tests: Playwright against Vercel preview (`BASE_URL` from `deployment_status` event); critical-path on Chromium, nightly extended suite on Firefox
- `.spec.ts` files are E2E-only and excluded from Vitest
- E2E tests that require an external backend need two independent skip guards: app-config visibility check (feature enabled in deployed app) and runner env var check (backend reachable from test runner)
- Global mocks configured for `next/navigation`, `next/link`, `posthog-js`, `@sentry/nextjs`

## Versioning and Releases

- Canonical version lives in `version.txt` (repo root); read by `products/dashboard/next.config.ts` for production telemetry
- Tags are SemVer: `vX.Y.Z`, driven by Conventional Commits (`feat:`, `fix:`, `BREAKING CHANGE:`)
- Release PRs are machine-generated by release-please; CodeRabbit skips them automatically

## Key Paths Quick Reference

| Path | Role |
|---|---|
| `AGENTS.md` | Agent bootstrap — read first |
| `ai/PLAYBOOKS.md` / `ai/playbooks/` | Procedure index + bodies |
| `ai/SKILLS.md` / `ai/skills/` | Skill index + bodies |
| `ai/MEMORY.md` | Durable facts and recent decisions |
| `spec/schema/` | Machine validation rules |
| `spec/policy/event-taxonomy.yaml` | Event naming and PII policy |
| `interfaces/interfaces.yaml` | Provider-agnostic logical contracts |
| `docs/AI_NATIVE_FRAMEWORK.md` | Full framework prose |
| `docs/ANALYTICS_STANDARD.md` | Event capture and error monitoring standard |
| `docs/QUALITY_STANDARD.md` | Testing, evals, and release confidence standard |
| `products/dashboard/lib/auth/` | Auth boundary (provider-specific logic stays here) |
| `version.txt` | Canonical repo version |
