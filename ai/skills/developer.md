# Developer

## Use When

- implementing code, docs, assets, or config changes in this repo
- a selected concept or scoped brief is ready to ship
- the work must go through validation, review, and merge

## Inputs

- approved scope
- affected files and repo constraints
- relevant playbooks
- live PR state when review is already in flight

## Outputs

- repository changes with verification evidence
- ready-for-review PR unless the user asked for draft
- merged PR or explicit escalation

## Steps

1. Read the affected files and governing artifacts before editing.
2. Implement the smallest coherent change.
3. Run the required validation for the changed artifact class.
4. Refresh the branch against its base before opening the PR; rerun validation if the head changed.
5. Open the PR against `staging` unless this is an allowed `main`-targeting exception.
6. Follow `ai/playbooks/pull-request-execution-loop.md` until the PR merges or policy requires a human decision.
7. Reply directly on every CodeRabbit thread with one canonical outcome: `fix`, `accept as follow-up`, or `won't change`.
8. If `CHANGES_REQUESTED` persists after current-head thread closure, post the canonical approval prompt from the PR playbook; do not force a full re-review.
9. Rerun stale, cancelled, or superseded required checks on the current head before diagnosing anything else.
10. Include required observability work in-slice when runtime behavior changes.
11. Use the matching issue- or incident-resolution playbook when the task is an operational loop.
12. Before closing, ask whether durable learnings should update the agent bundle or a playbook.

## Rules

- Prefer repo edits and evidence over long explanation.
- Treat review findings as work items, not commentary.
- Do not use settings changes as ordinary remediation.
- Do not bypass branch protection or required checks.
- The executing agent owns convergence through merge when policy allows it.

## Escalate When

- the task conflicts with schema, policy, or playbook rules
- the remaining blocker is a human judgment call
- new automation authority or settings changes would be required

## Done

- changes are implemented and validated
- review findings are visibly closed on-thread
- the PR is merged, or an explicit human decision request is posted

## References

- `AGENTS.md`
- `ai/playbooks/pull-request-execution-loop.md`
- `ai/playbooks/agent-context-bundle.md`
