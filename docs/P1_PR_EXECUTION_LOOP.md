# P1 - Pull request execution loop

## Operating target

This playbook targets 90% of pull requests resolved entirely by automation, with no human action required. Human action is reserved for decisions that require judgment, product direction, or explicit approval of irreversible production changes. It is not reserved for checking things that a deterministic tool or a configured AI reviewer can verify.

**Machines verify. Humans decide.**

Any verification step that still requires human attention is a gap in tooling, not a valid human checkpoint. Escalation to a human must carry a specific, bounded decision request—not an open-ended review task—with the full evidence bundle already compiled.

## Objective

Automate the path from open pull request to merge while preserving explicit human authority for changes that exceed defined risk thresholds.

P1 is the first operating playbook that runs continuously after repository foundation is in place. It defines how agents, CI, GitHub policy, and human decision points work together on every PR.

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

## Agent self-verification toolchain

Agents executing P1 **MUST** run the following toolchain before any approval or merge decision. No human checking substitutes for missing tool output.

Required tools:

- **Canonical validation** — `npm run validate` (lint + schema validation). Failing this is an unconditional blocker.
- **Automated AI review** — Repository-configured reviewer (currently GitHub Copilot via ruleset). Missing review evidence on the current head SHA is an unconditional blocker.
- **Branch freshness check** — Comparison of PR head ancestry against the protected base branch. Being behind is a blocker until resolved automatically or flagged with `sync:needed`.

Optional tools (enable as repository matures):

- Security scanning (e.g., CodeQL, Semgrep) — output feeds into residual risk determination.
- Dependency audit — `npm audit` or equivalent.
- Type checking — standalone typecheck command if separate from lint.
- Coverage delta — ensure changes do not reduce coverage below configured threshold.

Adding a tool to the optional toolchain promotes it to required. Removing a tool from required is a control-plane change and follows section 6.6.

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
- Approve: yes, when residual risk is downgraded to low by the residual risk engine
- Merge: yes, when residual risk is downgraded to low and all gates pass

Escalate when:

- The change affects the control plane (workflows, branch protection, review policy) — see section 6.6.
- The agent resolution loop exhausted its attempts without resolving all blocking findings.
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

Human decision is mandatory. Automation **MUST** produce a complete decision request (see section 5) before stopping. The human is asked to decide, not to re-verify automated work.

## Procedure

### 1. Ingest and classify

1. Read the PR diff, changed files, labels, and target branch.
2. Map changed paths and detected behavior to a risk tier.
3. Emit the classification as a label, status, or comment.
4. If any changed paths match the control-plane pattern, apply the `control-plane` label in addition to the risk label.

Classification should be conservative. When in doubt, move the PR upward in risk.

GitHub labels should be compact but self-explanatory:

- `risk:low`, `risk:med`, `risk:high` for initial risk
- `residual:low`, `residual:med`, `residual:high` for residual risk
- `sync:needed` when the PR branch is behind the protected base branch
- `control-plane` when the PR modifies workflow files, branch protection definitions, or review-policy logic
- `autofix:pending` when the residual risk engine has identified fixable findings and the resolution loop has not yet run
- `autofix:applied` when the resolution loop has applied fixes on this PR; prevents re-running the loop and escalates remaining issues

### 1.5 Determine residual risk

Residual risk is determined **automatically** by the residual risk engine (`p1-residual-risk-engine`). The engine runs when the configured reviewer submits a review on the current head SHA. No manual label setting is expected or required.

Engine rules:

1. If `risk:high`: set `residual:high` unconditionally. Post a decision request.
2. If `risk:med` and the PR has the `control-plane` label: set `residual:med`. The owner-decision path applies for personal repositories; a second human approval applies otherwise.
3. If `risk:med` and the configured reviewer state is `APPROVED` and all review threads are resolved or outdated: set `residual:low`.
4. If `risk:med` and the configured reviewer state is `CHANGES_REQUESTED`: set `autofix:pending` and leave `residual` unset until the resolution loop runs (see step 3.5).
5. If `risk:low` and the configured reviewer state is `APPROVED` or `COMMENTED`: set `residual:low`.
6. If `risk:low` and the configured reviewer state is `CHANGES_REQUESTED`: set `autofix:pending`.

If the PR head changes after residual risk is set, the engine **MUST** clear the existing `residual:*` label and re-evaluate from the new review evidence.

The engine **MUST NOT** skip a configured reviewer step and assign residual risk as though review had already happened.

### 2. Run deterministic checks

1. Execute required validation, lint, typecheck, test, and build commands for the repository.
2. Run security and dependency checks where applicable.
3. Fail closed when required checks are missing or inconclusive.

No PR should be approved or merged without passing required checks.

The canonical required check for this repository is `validate` (`npm run validate`). All additional toolchain checks should be registered as required checks in branch protection or as blocking policy gates.

### 2.5 Enforce branch freshness (automated)

Branch freshness is enforced automatically by the branch sync workflow (`p1-branch-sync`).

1. When the risk classification detects that a PR is behind the protected base branch, it applies `sync:needed`.
2. The branch sync workflow triggers on `sync:needed` and attempts an automatic rebase.
3. For same-repository branches: automation rebases onto the current base, force-pushes the result, and removes `sync:needed`. The policy check re-evaluates automatically after the push.
4. For fork branches: automation cannot push to the fork. It posts a structured sync request with the exact commands the PR author must run, then waits.
5. If the rebase produces conflicts, automation posts the exact conflicting file paths and stops. The PR author must resolve and repush. Automation resumes on the next push.

Branch freshness is a hard gate. A PR evaluation is stale if the base branch has advanced in a way that could affect policy, CI, CODEOWNERS, or runtime behavior.

Typical invalidation triggers:

- Branch protection or merge-policy changes
- Workflow or CI changes on the protected branch
- CODEOWNERS changes
- Framework or playbook changes that alter thresholds or checkpoints
- Behavior-changing merges into protected surfaces

### 3. Perform automated review

1. Run an agent review against the diff and repository context.
2. Produce concrete findings, not generic commentary.
3. Distinguish blocking findings from suggestions.
4. Attempt safe autofixes only when the policy allows it.

Automated review must leave an auditable artifact in the PR.

Repository-specific reviewer guidance **SHOULD** live in versioned files such as `.github/copilot-instructions.md` so the AI backend can be swapped without changing the playbook's policy.

For this repository, automated AI review is requested through a GitHub repository ruleset that enables GitHub Copilot code review on the default branch and on new pushes to matching pull requests. The ruleset controls when review is requested; `.github/copilot-instructions.md` controls repository-specific review behavior. The policy check **MUST** verify that expected Copilot review output actually appeared on the PR for the current head SHA before it treats review as complete.

For this repository, the intended review order is:

1. GitHub Copilot review is requested automatically by ruleset.
2. If the expected Copilot review does not appear or does not refresh on the latest head SHA, an authorized collaborator **MAY** explicitly request follow-up work by mentioning `@copilot` on the PR or by using the host platform's re-review UI.
3. If `@copilot` produces a new commit on the PR branch, automation **MUST** treat that commit like any other new head SHA: rerun required checks, require fresh review evidence where policy says so, and re-evaluate residual risk from the updated state.
4. The policy layer waits until Copilot review output is observable on the PR timeline.
5. The residual risk engine reads Copilot's review state and all review thread resolution status together with the initial risk label.
6. The residual risk engine sets the `residual:*` label from the combined evidence.

Host-platform note:

- GitHub may allow `@copilot` comments to trigger Copilot follow-up work even when there is no supported public REST or CLI endpoint for requesting a Copilot re-review directly.
- When a bot or app pushes a commit to the PR branch, direct PR-scoped checks may still run normally while some downstream `workflow_run` automation can enter an approval-required or `action_required` state under GitHub's trust model. That host safeguard **MUST NOT** be misinterpreted as a PR policy failure by itself.

### 3.5 Agent resolution loop

Before any human escalation, automation **MUST** attempt to resolve blocking findings.

The resolution loop runs when `autofix:pending` is applied:

1. Check out the PR branch.
2. Run all auto-fixable toolchain commands (e.g., `biome check --write .` for formatting and lint).
3. Commit any changes and push. Label the PR with `autofix:applied`.
4. Post a structured resolution comment listing what was fixed and what was not.
5. If everything is now fixed and `npm run validate` passes: remove `autofix:pending`. The Copilot reviewer re-runs on the new head SHA and the residual risk engine re-evaluates.
6. If unfixed issues remain after the resolution loop: post a structured decision request (see section 5) for the specific remaining items. Do not run the resolution loop again on the same PR once `autofix:applied` is set.

The resolution loop **MUST NOT** attempt fixes outside the safe autofix set. Changes that require reasoning about business logic, security intent, or product behavior are decision items, not autofix items.

Safe autofix actions:

- Formatting and style (biome, prettier, etc.)
- Import ordering
- Lint rule violations with deterministic fixes
- Whitespace and trailing-newline normalization

Not safe for automated fix:

- Logic changes
- Security-sensitive code paths
- Schema migrations
- Test assertions
- Anything that changes observable runtime behavior

### 4. Apply threshold policy

Decision rules:

- Initial risk sets review depth.
- Residual risk sets approval and merge authority.
- Residual low: automation may approve or merge when checks pass and no blocking findings remain.
- Residual medium: approval and merge follow repository-specific threshold policy.
- Residual high: human decision is mandatory before approval or merge.
- In a personal-repository deployment with a single human operator, threshold policy **MAY** allow the repository owner to act as the final human checkpoint for residual medium after all evidence gates pass, even when no second human reviewer exists.

A threshold policy should include at least:

- Affected paths or systems
- Diff size or complexity thresholds
- Branch freshness requirements
- Initial vs residual risk rules
- Required evidence types
- Required human approver roles
- Rollback expectations for risky changes

### 5. Resolve or escalate

1. If findings are autofixable and within authority, run the resolution loop (step 3.5) and rerun checks.
2. If findings are not autofixable, post a structured decision request (see below) with explicit findings and the exact action required.
3. If the PR crosses a human decision point, post the decision request with the evidence bundle before stopping.
4. If review conversations are already addressed by the latest branch state, automation **MAY** resolve those conversations explicitly after verification.

**Decision request format**

When automation must stop for a human, the escalation comment **MUST** follow this structure. The human should be able to act in under two minutes without reading any other document.

```
**P1 decision request**

[One sentence: the exact decision needed from you.]

**What changed**
[2–3 sentence summary of what this PR does, derived from the diff and PR description.]

**Why automation stopped**
[Exact reason: e.g., "`auth/permissions.ts` modified — production auth gate."]

**Automated verification (complete)**
- ✓ Required checks: all pass
- ✓ Review: completed by [reviewer] on [head SHA prefix]
- ✓ Branch: current with main

**Remaining items requiring your decision**
[Numbered list of specific findings. Each entry: file:line — description — why it cannot be auto-resolved.]

**Your options**
1. **Approve** — add your GitHub approval; merge proceeds automatically.
2. **Request changes** — push a commit addressing the items above; automation resumes on the new head.
3. **Close** — reject this PR.
```

If residual risk still requires human intervention, automation **MUST** finish every non-human step before stopping. At minimum this means:

- Branch freshness resolved or explicitly blocked with `sync:needed`
- Required checks either green or already rerunning for the current head SHA
- Residual risk label applied
- Resolution loop already run (if applicable)
- Decision request posted in the format above
- Required reviewer or approver requested when the host supports it
- Auto-merge enabled in advance when repository policy allows merge immediately after approval

The workflow **MUST NOT** deadlock indefinitely on an unavailable second human reviewer if repository policy explicitly names the owner as the terminal checkpoint for that risk tier.

### 6. Approve and merge

When the PR is within policy and all required checks have passed:

1. Apply the policy decision for the residual-risk tier.
2. Enable auto-merge or merge directly according to repository policy.
3. Ensure branch cleanup runs after merge.

Merge must be blocked if required checks are pending, stale, or bypassed.
Merge must also be blocked if the PR branch is behind the protected base branch.

### 6.5 Convergence rule

Automation **MUST** converge without manual label toggling when the only blocker is timing between checks.

Required behavior:

1. If a required validation check has not completed yet on the current head SHA, the system **MUST** avoid creating a stale blocking policy result solely because validation is still pending. Implementations MAY defer the policy decision to the validation gate or re-evaluate automatically after validation completes.
2. If branch freshness or residual-risk state is deterministically derivable from the current PR state, automation **MUST** set or refresh that state without manual intervention.
3. If a stale failure exists but a newer successful policy evaluation exists on the same head SHA, the newer result **MUST** control the merge decision.
4. Manual relabeling or comment nudges **SHOULD NOT** be required for ordinary convergence.
5. If the host platform places privileged downstream automation such as `workflow_run` jobs into an approval-required state solely because the triggering commit came from a bot or app, the implementation **SHOULD** treat direct PR-scoped required checks on the current head SHA as the primary merge signal and document the host safeguard separately.

This rule prevents false human escalation caused only by event ordering.

### 6.6 Control-plane changes

PRs that modify the PR automation control plane itself, including workflow files, branch-protection assumptions, or review-policy logic, **MUST** be evaluated under the currently merged policy on the protected branch, not the proposed policy in the PR branch.

Required behavior:

1. Automation changes do not self-validate until they are merged into the protected branch.
2. The active workflow version on the protected branch is the source of truth for labels, checks, and merge authority during review.
3. Control-plane PRs are identified by the `control-plane` label applied during risk classification. The residual risk engine **MUST NOT** auto-downgrade a `control-plane` PR to `residual:low` regardless of reviewer state. The minimum residual risk for a control-plane PR is `residual:med`.
4. Framework updates should record any bootstrap exception used to merge a control-plane change.

On a personal repository with no second human reviewer, implementations **SHOULD** minimize bootstrap exceptions by encoding the owner-decision path directly in policy for the allowed risk tiers, rather than relying on ad hoc manual overrides.

### 7. Record outcomes

Record:

- Initial risk tier
- Residual risk tier
- Branch freshness state
- Checks executed
- Findings summary
- Resolution loop outcome (applied / not needed / escalated)
- Approval source
- Merge decision
- Escalation reason if applicable

These records should be queryable from GitHub or emitted as framework events.

## Human decision points

Human involvement is required when any of the following apply:

- Residual high risk (auth, billing, migrations, production infrastructure, secrets)
- Control-plane change that cannot be auto-downgraded to `residual:low`
- Residual medium risk when repository policy requires a human checkpoint
- Agent resolution loop exhausted (all autofix attempts completed; non-fixable issues remain)
- Rebase conflict on a fork branch (automation cannot push; author must resolve)
- Confidence below the configured threshold

Human involvement is **NOT** required for:

- Verifying that checks pass — the check status is machine-observable
- Confirming that Copilot approved — review state is machine-observable
- Resolving lint or formatting issues — the resolution loop handles these
- Confirming branch freshness — the sync workflow handles this
- Setting `residual:*` labels — the residual risk engine handles this

When a human does act, they receive a decision request (section 5) with the full evidence bundle. Their action is one of: approve, request changes, or close.

## Recommended implementation layers

The primary implementation uses:

- **GitHub Actions** for deterministic checks and PR metadata workflows
- **Branch protection and auto-merge** for merge enforcement
- **AI reviewer backend** for code review and safe autofix proposals
- **Labels and check runs** for risk classification and residual risk state
- **Required policy check** (`decide`) that decides whether human approval is still necessary
- **Labels and checks** for branch freshness and update requirements

Implemented workflows:

- `p1-risk-classification` — Classifies changed paths; applies `risk:*`, `sync:needed`, `control-plane` labels
- `p1-residual-risk-engine` — Triggers on Copilot review submission; auto-assigns `residual:*` or `autofix:pending`
- `p1-branch-sync` — Triggers on `sync:needed`; auto-rebases same-repo branches; posts sync command for forks
- `p1-autofix` — Triggers on `autofix:pending`; runs tool-based fixes, commits, and posts resolution summary
- `p1-policy` — Required check `decide`; reads labels and evidence; passes or emits a structured decision request
- `p1-low-risk-automation` — Enables auto-merge when `residual:low` and all checks pass

Optional later layers:

- Merge queue
- Preview environments
- Policy engine for path-based authority
- Structured workflow state outside GitHub
- AI-driven semantic autofix (extends `p1-autofix` with an LLM backend for logic-level fixes)
- Coverage and performance regression gates

## Events

Example event names:

- `pr.opened`
- `pr.risk_classified`
- `pr.residual_risk_set`
- `pr.branch_outdated`
- `pr.branch_synced`
- `pr.branch_sync_failed`
- `pr.validation_completed`
- `pr.review_completed`
- `pr.autofix_applied`
- `pr.autofix_escalated`
- `pr.escalated`
- `pr.approved`
- `pr.auto_merge_enabled`
- `pr.merged`

## Notes for future variants

- P1 should eventually be encoded in machine-readable process definitions under `spec/processes/`.
- Risk tiering should evolve from simple path rules toward evidence-based thresholds incorporating security scanner output, coverage delta, and diff complexity scores.
- Approval policy should remain stricter than review policy.
- The reviewer backend may change over time; the threshold policy should not depend on a single provider.
- Branch freshness rules should remain policy-owned even if the repository changes reviewer backends or CI providers.
- Event ordering between validation and policy checks should be treated as an automation-convergence concern, not as a human-review concern.
- The resolution loop should be extended with an LLM-driven semantic fix layer once the safe autofix boundary is well-established. The tool interface for this is defined in `agents/interfaces.yaml`.
- The decision request format in section 5 is machine-generatable. Future versions should produce it from structured finding objects rather than free-form text.
