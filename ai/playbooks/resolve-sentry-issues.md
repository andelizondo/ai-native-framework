# Playbook: Resolve Sentry Issues

**Version:** 0.1  
**Authority:** Procedure playbook — operationalizes recurring Sentry incident triage and closure loops for this repository. Sits below schema, policy, interfaces, and higher-order framework docs.

---

## Objective

Resolve Sentry issues with the same audit-trail discipline used for GitHub issues:

1. assign and acknowledge the issue
2. keep the issue `unresolved` while the code fix is in flight
3. leave a triage note linked to the fix PR
4. verify closure using explicit evidence, not intuition
5. leave a resolution note and mark the issue `resolved`

This playbook applies especially to active production issues such as Sentry issues in `escalating` state.

---

## Inputs

| Input | Required for |
|-------|-------------|
| Sentry org and project | Issue lookup and mutation |
| Sentry issue ID or short ID | Triage target |
| Write-capable Sentry token | Assignment, notes, and resolution |
| Linked GitHub PR or fix branch | Audit trail and closure decision |
| Recent Sentry event data | Evidence-based resolution |
| Release or deploy context | Post-fix verification |

---

## Outputs

| Output | Result |
|--------|--------|
| Assigned Sentry issue | Clear ownership |
| Triage note linked to the active PR | In-flight audit trail |
| Evidence bundle for closure | Merge timestamp, `lastSeen`, recent events/releases |
| Resolution note | Human-readable closing rationale |
| `resolved` Sentry issue state | Incident loop completed |

---

## 1. Select And Inspect

1. List or identify the open Sentry issue to triage.
2. Prioritize issues that are active, unresolved, or `escalating` unless the operator gives a different scope.
3. Collect:
   - issue ID and short ID
   - title and root symptom
   - assignee
   - status
   - priority
   - `firstSeen` and `lastSeen`
   - recent events
   - release tags and deployment context
4. Identify the likely code or configuration path before opening or updating a PR.

---

## 2. Claim The Issue

As soon as the issue is accepted for work:

1. assign it to the responsible owner
2. mark it as seen
3. keep the status as `unresolved`

Do **not** resolve the issue merely because investigation started or a branch exists.

---

## 3. Leave A Triage Note

Post a Sentry note before or alongside the implementation work that records:

- the working root-cause hypothesis
- the GitHub PR link or branch carrying the fix
- why the issue remains `unresolved`
- the next action required before closure

The note should read like issue-tracking state, not like a chat transcript.

---

## 4. Fix Through The Standard Engineering Loop

1. Implement the fix in the repository.
2. Validate it with the appropriate local and CI evidence.
3. Open and merge the PR using `ai/playbooks/pull-request-execution-loop.md`.
4. Keep the Sentry issue `unresolved` until the merge and a basic post-merge evidence check are complete.

---

## 5. Verify Closure With Explicit Evidence

Before resolving the Sentry issue, collect all of the following:

1. the GitHub PR merged timestamp
2. the Sentry issue `lastSeen` timestamp
3. recent Sentry events for the issue
4. recent release or deploy identifiers associated with those events

Use those signals to decide:

- If `lastSeen` or recent events are still after the fix merge or on a newer release, keep the issue `unresolved` and investigate further.
- If the last observed events predate the merge and no post-merge recurrences are visible on later releases, the issue may be resolved.

Do not close a Sentry issue on confidence alone. The closure decision must be evidence-based.

---

## 6. Leave A Resolution Note And Resolve

When the evidence supports closure:

1. post a Sentry note that states:
   - which PR merged
   - when it merged
   - what the latest relevant Sentry evidence shows
   - when the issue should be reopened
2. mark the issue `resolved`

Recommended reopen rule:

- reopen if new events appear on a later release or after the merge timestamp and match the same failure mode

---

## Decision Rules

- Treat the Sentry issue as a governed parallel loop, not as passive observability metadata.
- Assignment, triage note, and resolution note are required parts of closure, not optional polish.
- Prefer exact timestamps and release identifiers in the closing rationale.
- If the Sentry API surface supports issue mutation and notes, use it directly; do not require manual UI cleanup for ordinary issue management.

---

## Escalation Conditions

Stop and escalate when:

- you do not have a write-capable Sentry token
- the issue cannot be tied to a concrete fix path or PR
- post-merge events still appear and the root cause is ambiguous
- the issue touches a high-stakes domain that requires explicit human review

---

## Canonical References

- `AGENTS.md`
- `ai/skills/developer.md`
- `ai/playbooks/pull-request-execution-loop.md`
- `docs/ANALYTICS_STANDARD.md`
- `docs/QUALITY_STANDARD.md`
