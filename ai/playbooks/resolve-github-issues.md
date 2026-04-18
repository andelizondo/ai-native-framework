# Playbook: Resolve GitHub Issues

**Version:** 0.1  
**Authority:** Procedure playbook — operationalizes recurring GitHub issue triage and resolution loops for this repository. Sits below schema, policy, interfaces, and higher-order framework docs.

---

## Objective

Resolve open GitHub issues with a governed, auditable loop that:

1. batches issues that share the same failing workflow step, file, or root cause
2. records intent on every issue before any file change
3. routes the fix through the standard PR execution loop
4. updates every issue again once the PR exists and when the fix outcome is clear

This playbook is the canonical procedure for recurring issue-resolution work such as nightly CI failures.

---

## Inputs

| Input | Required for |
|-------|-------------|
| Repository owner and name | Listing and updating issues |
| Open GitHub issues with labels, body, and comments | Triage and grouping |
| Current `main` HEAD | Branch creation |
| Applicable validation command(s) | Fix verification |
| `ai/playbooks/pull-request-execution-loop.md` | PR publication and merge |
| Risk rules for affected paths | Group classification and escalation |

---

## Outputs

| Output | Result |
|--------|--------|
| Grouped issue set with rationale | Shared-fix planning and audit trail |
| Pre-change comment on every in-scope issue | Intent recorded before edits |
| One PR per fix group | Batched implementation with review evidence |
| Post-PR comment on every in-scope issue | Issue-to-PR traceability |
| Closed, merged, or explicitly escalated issue state | No silent handoff |

---

## 1. Fetch And Filter

1. List all open GitHub issues for the repository.
2. Skip issues labeled `blocked`, `wontfix`, or `needs-triage`.
3. For every remaining issue, collect:
   - number
   - title
   - body
   - labels
   - comments
4. If the issue source is nightly CI, also inspect the failing workflow run and identify the failing step or file before grouping.

---

## 2. Group And Classify

1. Group issues by shared affected path, failing workflow step, or root cause.
2. Prefer one PR per group when multiple issues point at the same fix surface.
3. Record the grouping rationale before acting. The rationale should name:
   - the shared failing step, file, or root cause
   - why one PR is the smallest coherent batch
   - which issues are intentionally kept separate
4. Assign an initial risk tier per group using the touched-path rules:

   | Tier | Paths |
   |------|-------|
   | Low | `docs/**`, `README.md`, `CONTRIBUTING.md`, `.github/ISSUE_TEMPLATE/**` |
   | Med | `spec/**`, `scripts/**`, `agents/**`, `.github/workflows/**`, `package.json` |
   | High | auth, billing, secrets, migrations, infra |

5. Escalate immediately if a grouped fix touches a high-risk path or needs a human decision before code changes.

---

## 3. Comment Intent Before Editing

For **every** issue in scope, post a GitHub comment before any file change that states:

- what you plan to fix and why
- which other issues are batched with it, if any
- the branch name that will carry the fix
- the expected risk tier
- the exact owner action needed if a human checkpoint is expected later

This comment is required. Do not start editing first and explain later.

---

## 4. Implement By Group

1. Create one branch per issue group from the current `main` HEAD.
2. Use a `fix/` or `chore/` branch prefix unless the repository or operator requested another convention.
3. Make the minimum change that resolves the group.
4. Add or update tests when the failure mode should be locked down as a regression.
5. Run the required validation command(s).
6. Continue only if validation exits successfully.

If validation does not pass, keep the issue `open` and document the blocker on the issue or PR instead of forcing the change through.

---

## 5. Open And Drive The PR

1. Open one PR per issue group.
2. The PR body must include:
   - one `Closes #<issue>` line per resolved issue
   - a short summary of what changed and why
   - validation evidence
   - initial risk tier and residual-risk assessment
   - the checklist from `.github/pull_request_template.md`
3. Follow `ai/playbooks/pull-request-execution-loop.md` until the PR is merged or explicitly escalated.
4. If CodeRabbit or other required review loops open findings, close them per the PR playbook before calling the issue work complete.

---

## 6. Update Each Issue After The PR Exists

After the PR is opened, update every in-scope issue with:

- the PR link
- the current risk label on the PR
- the next required action

Use explicit next-action language such as:

- `auto-merge pending`
- `owner approval needed`
- `waiting on required checks`

Do not leave the issue as an implicit pointer to the PR with no state summary.

---

## 7. Close Or Escalate

1. Close the GitHub issue through the PR when the PR merges and the issue-closing reference is valid.
2. If the PR reaches a residual medium or high human checkpoint, stop automation only after:
   - all non-human steps are complete
   - the PR is approval-ready
   - the issue comment states the exact owner action needed
3. Never leave the loop in a dead state. If policy makes the owner the terminal checkpoint, say explicitly whether the owner should:
   - merge now
   - request changes
   - close the PR

---

## Decision Rules

- When multiple issues share the same failing workflow step or file, default to one grouped fix unless there is a clear reason to split them.
- Keep the fix group as small as possible while still matching the real root cause.
- Prefer issue comments that describe the decision path, not just the result.
- Do not create a separate issue-resolution process outside the PR execution loop; this playbook complements that loop and depends on it.

---

## Escalation Conditions

Stop and escalate when:

- the grouped fix would touch a high-risk path without explicit owner instruction
- the issue set cannot be grouped confidently from available evidence
- required validation cannot be run
- the fix depends on repository settings or other control-plane changes not explicitly requested

---

## Canonical References

- `AGENTS.md`
- `ai/playbooks/pull-request-execution-loop.md`
- `ai/playbooks/quality-standard-execution.md`
- `.github/pull_request_template.md`
