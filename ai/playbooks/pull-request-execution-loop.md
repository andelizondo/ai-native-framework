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
6. After initial risk classification, decide whether Qodo Code Review is needed:
   - `residual:low` path (`risk:low` or `risk:med` without `control-plane`): skip Qodo. Proceed to verification and merge.
   - `residual:high` or `residual:med` path (human decision required): post `/agentic_describe` and `/agentic_review` as PR comments to trigger Qodo review, then invoke the `qodo-pr-resolver` skill to resolve all findings in one pass and push the result.
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

- For high-risk PRs: trigger Qodo Code Review by posting `/agentic_describe` and `/agentic_review` as PR comments. Wait for Qodo to post its findings, then run `qodo-pr-resolver`.
- For low-risk PRs: Qodo is not invoked. `p1-policy` sets `residual:low` directly based on risk level.
- Qodo does not submit formal GitHub Reviews, so there is no `CHANGES_REQUESTED` state to clear. The `qodo-pr-resolver` skill handles finding resolution and reply closure.
- If a reviewer or bot pushes a new commit, treat it as a new head SHA and rerun the loop from current-head evidence.

### Finding closure before merge

- For high-risk PRs where Qodo was invoked: all Qodo findings must be resolved (via `qodo-pr-resolver`) before the human decision request is posted.
- Blocking findings must be fixed on the head SHA or explicitly waived by a human maintainer with visible rationale.
- Non-blocking findings still require a visible decision: `fix`, `accept as follow-up`, or `won't change`.
- For low-risk PRs: no reviewer findings to close — proceed directly to merge.
- If current-head evidence is complete but a required workflow run is stale, cancelled, or superseded by a later success on the same head SHA, rerun it instead of reaching for settings changes.

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

### Trigger Qodo review (high-risk PRs only)

Post these two comments on the PR to trigger Qodo Code Review:

> /agentic_describe

> /agentic_review

Then invoke the `qodo-pr-resolver` skill to resolve all findings and push fixes. Once all findings are resolved, post the standard decision request to the human.

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
- `.pr_agent.toml`
- `.mergify.yml`
