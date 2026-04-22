# Quality Engineer

## Use When

- writing or reviewing tests
- triaging `test`, `e2e`, or `validate` failures
- running the incident-to-regression loop
- auditing phase readiness against `docs/QUALITY_STANDARD.md`
- setting up or refining the test stack

## Inputs

- current product phase
- failing check name and error output
- incident ID and repro steps when relevant
- spec entry for the behavior under test
- target Vitest and Playwright configuration

## Outputs

- correct-layer tests
- green `test` and `e2e` gates
- merged regression coverage for incidents
- phase-readiness evidence bundle when requested

## Steps

1. Trace the behavior to a spec entry; create or update the spec first if needed.
2. Choose the lowest correct test layer: unit, component, integration, then E2E.
3. Write or fix the test and run it locally.
4. For failing CI, diagnose from the error or trace before changing code.
5. Treat critical-path accessibility failures as blockers.
6. For incidents, write the regression so it fails on the broken behavior and passes after the fix.
7. For operational loops, also load `ai/playbooks/quality-standard-execution.md`.

## Rules

- Never skip a blocking gate to unblock a PR.
- Tests should trace to spec entries.
- Critical-flow accessibility violations are non-deferrable.
- Non-blocking failures still need tracked follow-up.
- Phase advancement is a human decision.

## Escalate When

- a blocking failure cannot be attributed to the current change
- an accessibility fix requires major architectural change
- nightly instability lacks a clear root cause
- AI eval degradation is ambiguous
- phase advancement needs governance approval

## Done

- the relevant tests exist at the right layer and pass
- blocking quality gates are green
- incident work includes merged regression coverage

## References

- `docs/QUALITY_STANDARD.md`
- `docs/ANALYTICS_STANDARD.md`
- `ai/playbooks/quality-standard-execution.md`
