# P1 - Pull request execution loop

## Objective

Automate the path from open pull request to merge while preserving explicit human authority for changes that exceed defined risk thresholds.

P1 is the first operating playbook that runs continuously after repository foundation is in place. It defines how agents, CI, GitHub policy, and human checkpoints work together on every PR.

The AI reviewer backend **MUST** be treated as replaceable. The framework's policy layer decides authority; the reviewer implementation supplies comments, findings, and suggested changes.

## When to run

Run P1 for every pull request targeting a protected branch.

## Outcomes

At the end of this playbook, each PR should have:

- An initial risk classification.
- A residual risk decision after review.
- A branch freshness decision.
- Deterministic validation evidence.
- Automated review output.
- A decision: auto-approve, escalate, request changes, or merge when allowed.
- An audit trail recorded in GitHub state, comments, labels, checks, or events.

## Inputs

- Pull request metadata, diff, changed files, labels, and author.
- Branch protection rules and required check contexts.
- Repository test and validation commands.
- CODEOWNERS and protected path definitions.
- Threshold policy for low, medium, and high risk changes.
- AI reviewer backend configuration and repository-specific review instructions.
- Freshness policy for PR branches relative to the protected base branch.
- A policy decision check that maps residual risk to merge authority.

## Risk tiers

Initial risk answers: how carefully should this PR be reviewed?

Residual risk answers: after review and evidence, is human approval still required?

### Low risk

Typical examples:

- Documentation
- Comments
- Templates
- Non-runtime metadata
- Safe dependency bumps with passing checks

Default agent authority:

- Review: yes
- Approve: yes
- Merge: yes, if all required checks pass and policy gates are satisfied

Low-risk automation only works if branch protection and CODEOWNERS are scoped so that documentation-only or metadata-only changes do not still require human codeowner review.

### Medium risk

Typical examples:

- Application logic
- Schemas
- CI workflows
- Internal tooling
- Observability configuration

Default agent authority:

- Review: yes
- Approve: conditional
- Merge: conditional

Escalate when:

- The change affects protected surfaces.
- Automated review finds unresolved material risk.
- The diff is large, cross-cutting, or behavior-changing without clear evidence.

### High risk

Typical examples:

- Auth and permissions
- Billing and money movement
- Secrets handling
- Security policy
- Destructive migrations
- Production infrastructure access
- Irreversible user-facing effects

Default agent authority:

- Review: yes
- Approve: no
- Merge: no

Human approval is mandatory.

## Procedure

### 1. Ingest and classify

1. Read the PR diff, changed files, labels, and target branch.
2. Map changed paths and detected behavior to a risk tier.
3. Emit the classification as a label, status, or comment.

Classification should be conservative. When in doubt, move the PR upward in risk.

GitHub labels should be compact but self-explanatory:

- `risk:low`, `risk:med`, `risk:high` for initial risk
- `residual:low`, `residual:med`, `residual:high` for residual risk
- `sync:needed` when the PR branch is behind the protected base branch

## 1.5 Determine residual risk

1. Review the actual diff and validation evidence.
2. Identify whether the initial structural risk remains material after review.
3. Emit a residual-risk decision separately from the initial classification.

Residual risk may be lower than initial risk. Example: a workflow file change is structurally medium risk, but a one-line vetted dependency bump with passing checks may be residual low risk after review.

When residual risk is fully determined by repository policy and machine-observable evidence, automation **SHOULD** assign the residual-risk label directly instead of waiting for a manual follow-up step.

## 2. Run deterministic checks

1. Execute required validation, lint, typecheck, test, and build commands for the repository.
2. Run security and dependency checks where applicable.
3. Fail closed when required checks are missing or inconclusive.

No PR should be approved or merged without passing required checks.

## 2.5 Enforce branch freshness

1. Determine whether the PR branch is current with the protected base branch.
2. If the PR is behind, label it as `sync:needed` and stop approval or merge automation.
3. Re-run classification, review, and threshold checks after the branch is refreshed.
4. If automation owns PR creation, it **MUST** sync with the current protected base branch before opening the PR.

Branch freshness is a hard gate. A PR evaluation is stale if the base branch has advanced in a way that could affect policy, CI, CODEOWNERS, or runtime behavior.

Typical invalidation triggers:

- branch protection or merge-policy changes
- workflow or CI changes on the protected branch
- CODEOWNERS changes
- framework or playbook changes that alter thresholds or checkpoints
- behavior-changing merges into protected surfaces

## 3. Perform automated review

1. Run an agent review against the diff and repository context.
2. Produce concrete findings, not generic commentary.
3. Distinguish blocking findings from suggestions.
4. Attempt safe autofixes only when the policy allows it.

Automated review must leave an auditable artifact in the PR.

Repository-specific reviewer guidance **SHOULD** live in versioned files such as `.github/copilot-instructions.md` so the AI backend can be swapped without changing the playbook's policy.

For this repository, automated AI review is requested through a GitHub repository ruleset that enables GitHub Copilot code review on the default branch and on new pushes to matching pull requests. The ruleset controls when review is requested; `.github/copilot-instructions.md` controls repository-specific review behavior.

## 4. Apply threshold policy

Decision rules:

- Initial risk sets review depth.
- Residual risk sets approval and merge authority.
- Residual low: automation may approve or merge when checks pass and no blocking findings remain.
- Residual medium: approval and merge follow repository-specific threshold policy.
- Residual high: human review is mandatory before approval or merge.

A threshold policy should include at least:

- affected paths or systems
- diff size or complexity thresholds
- branch freshness requirements
- initial vs residual risk rules
- required evidence types
- required human approver roles
- rollback expectations for risky changes

## 5. Resolve or escalate

1. If findings are autofixable and within authority, update the branch and rerun checks.
2. If findings are not autofixable, request changes with explicit reasons.
3. If the PR crosses a human checkpoint, notify the required approver with the evidence bundle.

Escalation should be specific about why automation stopped.

If the PR is behind the protected branch, escalation should explicitly request a rebase or branch update before any further approval decision. Automation-owned PRs should treat this as a creation failure and reopen the review loop only after syncing.

## 6. Approve and merge

When the PR is within policy and all required checks have passed:

1. Apply the policy decision for the residual-risk tier.
2. Enable auto-merge or merge directly according to repository policy.
3. Ensure branch cleanup runs after merge.

Merge must be blocked if required checks are pending, stale, or bypassed.
Merge must also be blocked if the PR branch is behind the protected base branch.

## 6.5 Convergence rule

Automation **MUST** converge without manual label toggling when the only blocker is timing between checks.

Required behavior:

1. If a required validation check has not completed yet on the current head SHA, the system **MUST** avoid creating a stale blocking policy result solely because validation is still pending. Implementations MAY defer the policy decision to the validation gate or re-evaluate automatically after validation completes.
2. If branch freshness or residual-risk state is deterministically derivable from the current PR state, automation **MUST** set or refresh that state without manual intervention.
3. If a stale failure exists but a newer successful policy evaluation exists on the same head SHA, the newer result **MUST** control the merge decision.
4. Manual relabeling or comment nudges **SHOULD NOT** be required for ordinary convergence.

This rule prevents false human escalation caused only by event ordering.

## 6.6 Control-plane changes

PRs that modify the PR automation control plane itself, including workflow files, branch-protection assumptions, or review-policy logic, **MUST** be evaluated under the currently merged policy on the protected branch, not the proposed policy in the PR branch.

Required behavior:

1. Automation changes do not self-validate until they are merged into the protected branch.
2. The active workflow version on the protected branch is the source of truth for labels, checks, and merge authority during review.
3. Framework updates should record any bootstrap exception used to merge a control-plane change.

## 7. Record outcomes

Record:

- initial risk tier
- residual risk tier
- branch freshness state
- checks executed
- findings summary
- approval source
- merge decision
- escalation reason if applicable

These records should be queryable from GitHub or emitted as framework events.

## Recommended implementation layers

The first implementation should use:

- GitHub Actions for deterministic checks and PR metadata workflows
- Branch protection and auto-merge for merge enforcement
- An AI reviewer backend for code review and safe autofix proposals
- Labels or check runs for risk classification
- A required policy check that decides whether human approval is still necessary
- Labels or checks for branch freshness and update requirements

Optional later layers:

- Merge queue
- Preview environments
- Policy engine for path-based authority
- Structured workflow state outside GitHub

Initial backend for this repository:

- GitHub Copilot automatic code review via a repository ruleset targeting `~DEFAULT_BRANCH` with review on new pushes
- Repository custom instructions in `.github/copilot-instructions.md`
- GitHub Actions for classification, low-risk approval, and auto-merge orchestration

## Human checkpoints

Human involvement is required when any of the following apply:

- residual high risk
- residual medium risk when repository policy requires a human checkpoint
- unclear ownership
- branch is behind the protected base branch and cannot be refreshed automatically
- failing or flaky required checks
- unresolved blocking review findings
- security-sensitive paths
- broad cross-cutting refactors
- confidence below the configured threshold

## Baseline target for this repository

Recommended first implementation for this repository:

- Auto-classify PR risk from changed paths and labels.
- Distinguish initial risk from residual risk after review.
- Label outdated PRs with `sync:needed` and block automation until they are refreshed.
- Run `npm run validate` as the canonical required check.
- Run automated agent review on every PR, for example through a repository ruleset that requests GitHub Copilot review.
- Allow automation to merge residual-low PRs.
- Require a policy decision check before merge instead of a blanket GitHub review gate.
- Allow auto-merge only after required checks pass and policy allows approval.
- Require human review only when residual risk and policy thresholds still warrant it.
- Re-run policy automatically after fresh validation lands on the same head SHA when earlier policy runs failed only because validation was not ready yet.
- Keep approval and merge authority in GitHub policy and workflows, not in the AI reviewer backend itself.

## Events

Example event names:

- `pr.opened`
- `pr.risk_classified`
- `pr.residual_risk_set`
- `pr.branch_outdated`
- `pr.branch_refreshed`
- `pr.validation_completed`
- `pr.review_completed`
- `pr.escalated`
- `pr.approved`
- `pr.auto_merge_enabled`
- `pr.merged`

## Notes for future variants

- P1 should eventually be encoded in machine-readable process definitions under `spec/processes/`.
- Risk tiering should evolve from simple path rules toward evidence-based thresholds.
- Approval policy should remain stricter than review policy.
- The reviewer backend may change over time; the threshold policy should not depend on a single provider.
- Branch freshness rules should remain policy-owned even if the repository changes reviewer backends or CI providers.
- Event ordering between validation and policy checks should be treated as an automation-convergence concern, not as a human-review concern.
