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
6. Use the exact canonical outcome text from `.coderabbit.yaml` in every thread reply: `fix`, `accept as follow-up`, or `won't change`. Prefer starting the reply with `fix:`, `accept as follow-up:`, or `won't change:` so the closure is machine- and human-scannable. Do not substitute synonyms like "fixed", "addressed", or "deferred", and do not rely on a commit hash alone.
7. If you push a commit that addresses review findings, post those per-thread outcome replies in the same work cycle before moving on to waiting for checks, reviewer reruns, or merge decisions. Do this even if CodeRabbit may auto-resolve the thread after re-review; thread history still needs the human-visible resolution note. Do not treat "fix committed" as sufficient closure by itself, and do not replace per-thread replies with a consolidated PR comment.
8. Before considering the PR loop complete, explicitly verify that every active CodeRabbit finding has one of those exact outcome replies on the thread or is outdated/resolved by reviewer confirmation on the current head.
9. **Request a fresh CodeRabbit review when threads or the submitted review state are stuck:** After you push fixes or post per-thread outcomes, if **review threads are still unresolved** on the current head, post **`@coderabbitai review`** so CodeRabbit can re-run and update threads. If **every** thread has a visible `fix:` / `accept as follow-up:` / `won't change:` reply (or is outdated) and the substance is confirmed, but GitHub still shows **`CHANGES_REQUESTED`** from CodeRabbit **without** a new submitted review on the **current** head, post **`@coderabbitai review`** so CodeRabbit can submit a fresh review (including approval when appropriate) and replace the stale request-changes state. This is **not** for skipping thread closure or for “speeding up” an already-healthy review—see `ai/playbooks/pull-request-execution-loop.md` for when **not** to post (e.g. while a review is clearly in progress; use the bounded wait there first).
10. If a required check is stale or cancelled on the current head, rerun that job immediately before diagnosing anything else. A cancelled check on the current head SHA almost always clears with a rerun in under a minute — do not reach for workarounds first.
11. When runtime behavior changes, include observability in-slice rather than as a follow-up: baseline exception capture, release and environment tagging, and main-path trace coverage. Follow the canonical observability guidance in framework tooling reference §10 for deeper Sentry requirements such as Replay, monitors/check-ins, source maps, and AI/tool-flow instrumentation.
12. Before treating the work as fully closed, ask whether the completed workflow revealed durable learnings that should update the framework bundle or a playbook.
13. When every configured merge gate for the current head is green and review threads are handled per playbook, **also** confirm the latest **submitted** GitHub review from each configured AI reviewer on **that same head SHA** is not **`CHANGES_REQUESTED`** (checks alone are not enough—use the PR Reviews tab or `gh api repos/<owner>/<repo>/pulls/<n>/reviews`). If aggregate **`CHANGES_REQUESTED`** remains only on **superseded** submissions from earlier SHAs after fixes and thread closure on the current head (for example reviewer rate limit prevented a new submission), escalate to a **maintainer** to **dismiss** those stale reviews with a documented message per `ai/playbooks/pull-request-execution-loop.md`—do not treat dismissal as a substitute for substance. Then **complete the merge** using a method the repository allows; if `gh pr merge` fails for merge-method policy, read the host error, then retry **squash** first and **rebase** second unless docs say otherwise, and leave a short operator-visible note of what was tried. If the PR still does not land, diagnose queue stalls, labels, draft state, base-branch drift, or escalate with evidence. If the repo uses a merge queue (such as Mergify), **verify** the PR merged once queue conditions are met; if the PR left the queue, use `@mergifyio queue` with the queue name from `.mergify.yml` after gates are green again. Do not stop at “PR opened” or “checks running.” Prefer bounded waits or the operator signaling that checks finished over endless polling.

## Decision Rules

- Prefer repository edits and evidence over long explanations of what could be done.
- Treat review findings as work items, not commentary.
- Do not treat repository settings changes as ordinary remediation; they are separate control-plane work unless explicitly requested.
- Do not bypass branch protection or required checks to make progress.
- For product code, do not treat observability as optional polish. A feature is incomplete if its failure modes are materially opaque in production when the framework expects Sentry-class error monitoring.

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
