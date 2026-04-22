# Quality standard execution

## Use When

- a PR quality gate fails
- nightly CI fails
- a production incident needs regression coverage
- a phase-readiness audit is requested

## Inputs

- current product phase
- current check states
- nightly run URL and failure summary
- incident ID and repro steps

## Outputs

- green blocking gates
- triaged nightly outcome
- merged regression coverage
- phase evidence bundle when requested

## Steps

1. For PR gates, confirm spec validity first, then test, preview/E2E, reviewer state, and policy gates.
2. Diagnose failures in order: spec/schema, unit/component, integration, E2E, accessibility, deployment smoke.
3. For new behavior, add tests at the correct layer before or alongside the change.
4. For nightly failures, classify the root cause as product regression, flaky test, environment issue, or external dependency change, then set the right deadline and close only after green confirmation.
5. For incidents, reproduce first, write the regression at the lowest correct layer, confirm it fails before the fix and passes after it, then run the full loop through merge.
6. For AI-mediated incidents, update the golden dataset and rerun evals when the standard requires it.
7. For phase advancement, verify each checklist item from the real repo state and present evidence; do not self-advance.

## Constraints

- do not skip blocking gates
- critical-flow accessibility failures block merge
- incident closure requires merged regression coverage
- phase advancement remains a human decision

## References

- `docs/QUALITY_STANDARD.md`
- `ai/playbooks/pull-request-execution-loop.md`
