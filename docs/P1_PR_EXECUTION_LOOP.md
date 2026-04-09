# P1 - Pull request execution loop

## Objective

Automate the path from open pull request to merge while preserving explicit human authority for changes that exceed defined risk thresholds.

P1 is the first operating playbook that runs continuously after repository foundation is in place. It defines how agents, CI, GitHub policy, and human checkpoints work together on every PR.

## When to run

Run P1 for every pull request targeting a protected branch.

## Outcomes

At the end of this playbook, each PR should have:

- A risk classification.
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

## Risk tiers

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

## 2. Run deterministic checks

1. Execute required validation, lint, typecheck, test, and build commands for the repository.
2. Run security and dependency checks where applicable.
3. Fail closed when required checks are missing or inconclusive.

No PR should be approved or merged without passing required checks.

## 3. Perform automated review

1. Run an agent review against the diff and repository context.
2. Produce concrete findings, not generic commentary.
3. Distinguish blocking findings from suggestions.
4. Attempt safe autofixes only when the policy allows it.

Automated review must leave an auditable artifact in the PR.

## 4. Apply threshold policy

Decision rules:

- Low risk: agent may approve and enable merge when checks pass and no blocking findings remain.
- Medium risk: agent may review and prepare the PR, but approval and merge follow repository-specific threshold policy.
- High risk: human review is mandatory before approval or merge.

A threshold policy should include at least:

- affected paths or systems
- diff size or complexity thresholds
- required evidence types
- required human approver roles
- rollback expectations for risky changes

## 5. Resolve or escalate

1. If findings are autofixable and within authority, update the branch and rerun checks.
2. If findings are not autofixable, request changes with explicit reasons.
3. If the PR crosses a human checkpoint, notify the required approver with the evidence bundle.

Escalation should be specific about why automation stopped.

## 6. Approve and merge

When the PR is within policy and all required checks have passed:

1. Apply approval if the actor is permitted to approve that risk tier.
2. Enable auto-merge or merge directly according to repository policy.
3. Ensure branch cleanup runs after merge.

Merge must be blocked if required checks are pending, stale, or bypassed.

## 7. Record outcomes

Record:

- risk tier
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
- An agent reviewer for code review and safe autofix proposals
- Labels or check runs for risk classification

Optional later layers:

- Merge queue
- Preview environments
- Policy engine for path-based authority
- Structured workflow state outside GitHub

## Human checkpoints

Human involvement is required when any of the following apply:

- high-risk change
- unclear ownership
- failing or flaky required checks
- unresolved blocking review findings
- security-sensitive paths
- broad cross-cutting refactors
- confidence below the configured threshold

## Baseline target for this repository

Recommended first implementation for this repository:

- Auto-classify PR risk from changed paths and labels.
- Run `npm run validate` as the canonical required check.
- Run automated agent review on every PR.
- Allow agent approval only for low-risk PRs.
- Allow auto-merge only after required checks pass and policy allows approval.
- Require human review for schema, workflow, security, and policy changes until thresholds are refined further.

## Events

Example event names:

- `pr.opened`
- `pr.risk_classified`
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
