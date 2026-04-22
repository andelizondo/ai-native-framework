# Pull request execution loop

## Use When

- any PR targets a protected branch
- designing or operating PR automation, review policy, freshness, or merge authority

## Inputs

- PR metadata, diff, labels, and target branch
- branch protection and required checks
- repo validation and test commands
- reviewer configuration and review state
- threshold policy and path-based risk rules

## Outputs

- initial and residual risk state
- branch freshness state
- validation and review evidence
- merge, escalation, or closure decision

## Steps

1. Refresh the branch against its base before opening or updating the PR. Do not publish a knowingly stale head.
2. Classify initial risk from changed paths and apply the policy labels: `risk:*`, `control-plane`, `sync:needed`, `autofix:*`, `residual:*`.
3. Run deterministic checks and wait for every configured merge gate on the current head SHA.
4. Require current-head reviewer evidence, not just a generic green status row.
5. Enforce branch freshness. Behind branches must sync before merge.
6. Treat review findings as work items. Close each CodeRabbit thread with `fix`, `accept as follow-up`, or `won't change`.
7. If review leaves only safe autofix work, run the one-shot autofix loop and re-evaluate on the new head.
8. Set residual risk from initial risk plus current-head review state and thread state.
9. If policy allows automation to merge, verify every gate is green and complete the merge or queue path.
10. If policy requires a human, finish all non-human work first and post a bounded decision request with the evidence bundle.
11. Record the resulting risk, checks, findings, and merge or escalation outcome in observable PR state.

## Rules

### Operating target

- Machines verify. Humans decide.
- The target is maximum automation for verification work and explicit escalation only for real judgment calls.
- The reviewer backend and merge executor are replaceable. Policy owns authority; tools supply evidence and execution.

### Required evidence before approval or merge

- `npm run validate` must pass when relevant to the change.
- Every configured merge gate on the current head SHA must be terminal and green.
- The configured reviewer status context is required but not sufficient by itself.
- The latest submitted AI review state on the current head SHA matters separately from the status check.
- Current-head review output must actually exist on the PR timeline.
- Branch freshness against the protected base branch is a hard gate.

### Risk and residual risk

- `risk:low`: docs, comments, templates, non-runtime metadata, safe dependency bumps.
- `risk:med`: app logic, schemas, CI workflows, internal tooling, observability configuration.
- `risk:high`: auth, billing, secrets, security policy, destructive migrations, production infra, irreversible effects.
- `risk:high` always becomes `residual:high`.
- `control-plane` PRs never auto-downgrade below `residual:med`.
- `risk:low` or `risk:med` can become `residual:low` only when current-head reviewer state is acceptable and threads are resolved or outdated.
- If reviewer state still requests changes or unresolved threads remain, prefer `autofix:pending` over premature residual labels.

### Review order and recovery

- Wait for CodeRabbit auto-review first.
- If there is no reviewer signal after about 15 seconds on a new head SHA, `@coderabbitai review` is allowed.
- If review clearly started, wait up to 5 minutes before asking whether to trigger recovery.
- When current-head thread closure is complete but `CHANGES_REQUESTED` persists, use the canonical approval prompt instead of forcing a full re-review.
- If a reviewer or bot pushes a new commit, treat it as a new head SHA and rerun the loop from current-head evidence.

### Finding closure before merge

- A green reviewer check is necessary but not sufficient.
- Blocking findings must be fixed on the head SHA or explicitly waived by a human maintainer with visible rationale.
- Non-blocking findings still require a visible decision on the thread: `fix`, `accept as follow-up`, or `won't change`.
- Do not resolve threads just to satisfy GitHub conversation rules without visible substance.
- A consolidated PR comment does not replace per-thread closure when policy depends on thread state.
- If current-head evidence is complete but a required workflow run is stale, cancelled, or superseded by a later success on the same head SHA, rerun it instead of reaching for settings changes.
- If only stale older reviewer submissions keep `CHANGES_REQUESTED` alive after current-head closure, a maintainer may dismiss them with a visible message naming the current head and why the stale review no longer applies.

### Autofix loop

- The autofix loop runs once when `autofix:pending` is applied.
- Safe autofix only: formatting, style, import ordering, deterministic lint fixes, whitespace normalization.
- Not safe for autofix: logic changes, security-sensitive code, schema migrations, test assertions, or any runtime behavior change.
- After autofix, push, mark `autofix:applied`, post what changed, and re-evaluate on the new head.
- Do not rerun the autofix loop indefinitely on the same PR.

### Merge ownership and convergence

- The executing agent owns convergence through merge when policy allows it.
- “PR opened” is not completion. If the PR is mergeable, finish the merge or verify the queue merged it.
- If the first merge method is rejected, retry with an allowed method in repo policy order and keep the outcome operator-visible.
- If the PR still does not land, diagnose the real blocker: missing residual label, stale checks, dequeued queue state, draft state, sync state, conflicts, or queue stall.
- Do not rely on unbounded polling. Use bounded waits and re-check when the operator signals checks are done.
- Automation should converge without manual label nudges when timing between checks is the only blocker.

### Control-plane handling

- Control-plane PRs are evaluated under currently merged policy, not the proposed policy in the PR branch.
- Workflow, branch-protection, and review-policy changes do not self-validate before merge.
- Document any bootstrap exception used to land a control-plane change.

## Canonical Snippets

### Approval prompt

Use this when current-head thread closure is complete but `CHANGES_REQUESTED` still persists and a full re-review is not desired:

> @coderabbitai Requested changes are addressed on the current head. Please approve or clear the pending request-changes when satisfied.

### Decision request template

Use this when automation must stop for a human decision:

```md
**P1 decision request**

[One sentence: the exact decision needed from you.]

**What changed**
[2-3 sentence summary of what this PR does, derived from the diff and PR description.]

**Why automation stopped**
[Exact reason: e.g., "`auth/permissions.ts` modified - production auth gate."]

**Automated verification (complete)**
- ✓ Required checks: all pass
- ✓ Review: completed by [reviewer] on [head SHA prefix]
- ✓ Branch: current with main

**Remaining items requiring your decision**
[Numbered list of specific findings. Each entry: file:line - description - why it cannot be auto-resolved.]

**Your options**
1. **Approve** - add your GitHub approval; merge proceeds automatically.
2. **Request changes** - push a commit addressing the items above; automation resumes on the new head.
3. **Close** - reject this PR.
```

## Constraints

- machines verify; humans decide
- current-head evidence matters more than stale older runs
- green reviewer status alone is insufficient without visible thread closure
- stale or superseded required checks on the current head should be rerun, not worked around
- the executing agent owns convergence through merge when policy allows it
- control-plane PRs are never auto-downgraded to low residual risk

## References

- `AGENTS.md`
- `.coderabbit.yaml`
- `.mergify.yml`
