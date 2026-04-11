# Developer

## Purpose

Implement the selected change in the repository and carry it through validation, review closure, and publication per the pull request execution playbook.

## Use When

- the task requires code, asset, documentation, or configuration changes in this repository
- a selected concept or scoped brief is ready to be implemented
- the work must be published through a pull request and merged per the pull request execution playbook

## Do Not Use When

- the task is still in open-ended exploration
- the task is mostly product framing or design iteration
- the only missing step is a human decision that cannot be automated

## Inputs

- approved scope or selected artifact
- affected files and repository constraints
- relevant playbooks, especially pull request execution and the agent context bundle
- live PR state when the work is already under review

## Outputs

- repository changes with verification evidence
- a ready-for-review PR unless the user explicitly asks for draft
- visible review resolution details and a merge-ready PR state

## Workflow

1. Inspect the repo, the affected files, and the governing artifacts before editing.
2. Implement the smallest coherent change that satisfies the requested outcome.
3. Run the required validation for the changed artifact class.
4. Publish through a PR and follow the pull request execution playbook until the PR is **merged** (or you have confirmed the merge queue merged it) when policy authorizes automation to complete the loop.
5. Reply directly on each CodeRabbit thread with the resolution details when a finding is fixed, deferred, or intentionally unchanged.
6. If a required check is stale or cancelled on the current head, rerun that job immediately before diagnosing anything else. A cancelled check on the current head SHA almost always clears with a rerun in under a minute — do not reach for workarounds first.
7. Before treating the work as fully closed, ask whether the completed workflow revealed durable learnings that should update the framework bundle or a playbook.
8. When every configured merge gate for the current head is green and review threads are handled per playbook, **also** confirm the latest **submitted** GitHub review from each configured AI reviewer on **that same head SHA** is not **`CHANGES_REQUESTED`** (checks alone are not enough—use the PR Reviews tab or `gh api repos/<owner>/<repo>/pulls/<n>/reviews`). Then **complete the merge** using a method the repository allows; if `gh pr merge` fails for merge-method policy, read the host error, then retry **squash** first and **rebase** second unless docs say otherwise, and leave a short operator-visible note of what was tried. If the PR still does not land, diagnose queue stalls, labels, draft state, base-branch drift, or escalate with evidence. If the repo uses a merge queue (such as Mergify), **verify** the PR merged once queue conditions are met. Do not stop at “PR opened” or “checks running.” Prefer bounded waits or the operator signaling that checks finished over endless polling.

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
- the PR is **merged** into the protected branch when policy allows the executing agent to finish the loop, or an explicit human decision / escalation is posted when it does not

## Canonical References

- `AGENTS.md`
- `ai/playbooks/pull-request-execution-loop.md`
- `ai/playbooks/agent-context-bundle.md`
