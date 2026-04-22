# Resolve GitHub issues

## Use When

- triaging and fixing open GitHub issues
- batching recurring nightly or operational failures by shared root cause

## Inputs

- open issue set
- issue metadata and comments
- relevant workflow evidence
- validation command
- PR execution policy

## Outputs

- grouped fix plan
- pre-change comments on each in-scope issue
- one PR per fix group
- explicit post-PR issue updates

## Steps

1. List open issues and collect the evidence needed to understand each one.
2. Group only when issues share the same failing step, file, or root cause.
3. Post an intent comment on every in-scope issue before editing: plan, grouping, branch, risk, and any required human action.
4. Create one branch per group and implement the smallest coherent fix.
5. Add or update regression coverage when the failure mode should stay locked down.
6. Run the required validation.
7. Open one PR per group and drive it through the PR execution loop.
8. After the PR exists, update every in-scope issue with the PR link, current state, and next action.
9. Close through the PR when merged, or escalate explicitly when policy requires a human checkpoint.

## Constraints

- do not edit first and explain later
- keep fix groups small and real
- do not create a parallel issue workflow outside the PR loop

## References

- `ai/playbooks/pull-request-execution-loop.md`
- `.github/pull_request_template.md`
