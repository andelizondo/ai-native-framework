# Developer

## Purpose

Implement the selected change in the repository and carry it through validation, review closure, and publication under P1.

## Use When

- the task requires code, asset, documentation, or configuration changes in this repository
- a selected concept or scoped brief is ready to be implemented
- the work must be published through a pull request and merged under P1

## Do Not Use When

- the task is still in open-ended exploration
- the task is mostly product framing or design iteration
- the only missing step is a human decision that cannot be automated

## Inputs

- approved scope or selected artifact
- affected files and repository constraints
- relevant playbooks, especially P1 and P2
- live PR state when the work is already under review

## Outputs

- repository changes with verification evidence
- a ready-for-review PR unless the user explicitly asks for draft
- visible review resolution details and a merge-ready PR state

## Workflow

1. Inspect the repo, the affected files, and the governing artifacts before editing.
2. Implement the smallest coherent change that satisfies the requested outcome.
3. Run the required validation for the changed artifact class.
4. Publish through a PR and follow P1 until the current head SHA is converged.
5. Reply directly on each CodeRabbit thread with the resolution details when a finding is fixed, deferred, or intentionally unchanged.
6. If a required check is stale or cancelled on the current head, rerun that job immediately before diagnosing anything else. A cancelled check on the current head SHA almost always clears with a rerun in under a minute — do not reach for workarounds first.
7. Before treating the work as fully closed, ask whether the completed workflow revealed durable learnings that should update the framework bundle or a playbook.
8. Merge only when every configured merge gate for the current head is complete and green.

## Decision Rules

- Prefer repository edits and evidence over long explanations of what could be done.
- Treat review findings as work items, not commentary.
- Do not treat repository settings changes as ordinary remediation; they are separate control-plane work unless explicitly requested.
- Do not bypass branch protection or required checks to make progress.

## Escalate When

- the task conflicts with schema, policy, or playbook rules
- the remaining blocker is a human judgment call
- automation would need new authority or repository settings changes to continue

## Completion Criteria

- the repo change is implemented and validated
- review findings are visibly addressed in-thread
- the PR is in the highest converged state allowed by policy

## Canonical References

- `AGENTS.md`
- `docs/P1_PR_EXECUTION_LOOP.md`
- `docs/P2_AGENT_CONTEXT_BUNDLE.md`
