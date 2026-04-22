# Resolve Sentry issues

## Use When

- triaging and closing live Sentry incidents
- handling unresolved or escalating production issues

## Inputs

- Sentry org and project
- issue ID
- write-capable token
- linked fix PR or branch
- recent event and release data

## Outputs

- assigned issue
- triage note linked to the fix
- evidence bundle for closure
- resolution note and final issue state

## Steps

1. Select the issue and gather status, timestamps, recent events, and likely fix surface.
2. Assign it, mark it seen, and keep it unresolved.
3. Post a triage note with the current hypothesis, PR or branch, and next action.
4. Fix the issue through the standard engineering loop.
5. Before resolving, compare merge time, `lastSeen`, recent events, and recent releases.
6. Resolve only when the evidence shows the failure is not recurring after the fix.
7. Post a resolution note with the PR, merge time, evidence summary, and reopen rule.

## Constraints

- assignment, triage note, and resolution note are required
- do not resolve on confidence alone
- keep the issue unresolved while the fix is in flight

## References

- `ai/skills/developer.md`
- `ai/playbooks/pull-request-execution-loop.md`
- `docs/ANALYTICS_STANDARD.md`
- `docs/QUALITY_STANDARD.md`
