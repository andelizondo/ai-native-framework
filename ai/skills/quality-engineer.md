# Quality Engineer

## Purpose

Implement, maintain, and execute the verification system for framework-aligned products. The Quality Engineer skill covers the full scope of `docs/QUALITY_STANDARD.md`: writing tests at the correct layer, running CI gates, triaging failures, executing the incident-to-regression loop, and advancing the product's quality maturity phase.

## Use When

- Writing or reviewing tests for a new feature (unit, component, integration, E2E)
- Triaging a failing CI check (`test`, `e2e`, `validate`)
- Executing the incident-to-regression loop after a production issue
- Auditing a product's Phase 1/2/3 readiness against the Quality Standard checklist
- Setting up or configuring the test stack (Vitest, Playwright, MSW) for a new product
- Reviewing accessibility failures from axe-core and deciding fix vs. defer

## Do Not Use When

- The task is purely about event capture, PII rules, or PostHog/Sentry wiring — that is `docs/ANALYTICS_STANDARD.md` territory
- The task is a framework-level architecture audit — use the `Framework Keeper` skill
- The task is implementing a new product feature with no quality/test focus — use the `Developer` skill

## Inputs

- The product's current phase (from `docs/QUALITY_STANDARD.md §8`)
- The failing check name, error output, and Playwright report (if E2E)
- The incident ID and reproduction steps (for incident-to-regression work)
- Spec entry for the behavior under test
- Vitest and Playwright configs for the target product

## Outputs

- Tests that pass in CI and are anchored to a spec entry
- A passing `test` check and `e2e` check on the PR
- A regression test merged before incident closure
- A phase readiness evidence bundle (for phase advancement)

## Workflow

### Writing a new test

1. Identify the spec entry the behavior traces to. If none exists, create it first.
2. Choose the correct layer (see decision tree below).
3. Write the test. Run it locally: `npm test` (Vitest) or `npx playwright test` (E2E).
4. Confirm the test is green before opening a PR.
5. Check that coverage of new lines is reasonable — don't chase a percentage, but untested critical paths should have at least one test.

### Layer decision tree

```
Is it a pure function / data transform / utility?
  → Unit test in __tests__/lib/

Is it a React component (rendering, interaction, accessibility semantics)?
  → Component test in __tests__/components/

Is it a server action / API route handler / multi-component flow?
  → Integration test in __tests__/api/ or a Vitest integration test

Is it a user-visible browser flow requiring navigation or real HTTP?
  → E2E test in e2e/
    Critical path (≤10 scenarios)? → e2e/critical-paths.spec.ts (blocking gate)
    Non-critical? → nightly suite or separate spec file
```

### Diagnosing a failing `test` check

1. Read the error output in CI. Identify the file, test name, and assertion.
2. Run the same test locally: `npm test -- --reporter=verbose`.
3. If the assertion is wrong (spec changed): update the test.
4. If the code is wrong: fix the code, not the test.
5. Never skip or mark the test as `todo` to unblock a PR.

### Diagnosing a failing `e2e` check

1. Download the Playwright HTML report from the CI artifact.
2. Check the trace viewer for the failing step.
3. Classify: app bug, flaky selector, accessibility violation, or smoke failure.
4. Accessibility violations on critical flows: fix in the component, don't exclude the rule.
5. Flaky selector: use `getByRole` or `getByText` over CSS selectors; add `await expect(...).toBeVisible()` before interactions.

### Incident-to-regression loop

Follow `ai/playbooks/quality-standard-execution.md §3` exactly. The key invariant: the regression test must **fail** on the incident-era code and **pass** after the fix. Do not write a test that only validates the fixed behavior without demonstrating it would have caught the regression.

## Decision Rules

- Never skip a blocking gate to unblock a PR. If a gate is broken, fix it.
- Accessibility violations on critical flows are non-negotiable blockers. Fix in the component.
- Tests must trace to a spec entry. If no spec entry exists, create it first.
- Non-blocking failures (nightly, non-critical a11y) still require a tracked issue within 24 hours.
- Visual regression is not introduced without explicit scope — don't add screenshot tests "while you're here."
- Phase advancement is a human decision. Present the evidence bundle; do not self-advance.

## Escalate When

- A blocking gate failure cannot be attributed to the current change.
- An accessibility violation requires a significant architectural change to fix.
- The nightly suite is flaky across multiple nights without a clear root cause.
- An AI eval drops below threshold and the degradation is ambiguous.
- Phase advancement requires a governance decision.

## Completion Criteria

- The relevant tests exist, are anchored to spec entries, and pass in CI.
- The `test` and `e2e` blocking gates are green on the PR.
- Any new accessibility scan passes on critical flows.
- Nightly failures are tracked as open issues (not silently ignored).
- For incident work: regression test is merged and the incident is closed with a PR reference.

## Canonical References

- `docs/QUALITY_STANDARD.md` — normative standard
- `docs/ANALYTICS_STANDARD.md` — cross-reference for observability/PII boundary
- `ai/playbooks/quality-standard-execution.md` — operational procedure
- `products/dashboard/vitest.config.ts` — Vitest config (dashboard reference)
- `products/dashboard/playwright.config.ts` — Playwright config (dashboard reference)
- `products/dashboard/__tests__/` — test suite (dashboard reference)
- `products/dashboard/e2e/` — E2E suite (dashboard reference)
- `products/dashboard/tests/msw/` — MSW handlers (dashboard reference)
