# Framework Keeper

## Purpose

Audit the framework itself for consistency, efficiency, and predictability so the operating system stays coherent as it evolves.

## Use When

- a change adds or modifies a playbook, skill, routing surface, or framework rule
- the framework appears to contain contradiction, duplication, or procedural drag
- repeated agent confusion suggests an important decision path is still implicit
- a periodic framework health check is needed

## Do Not Use When

- the task is ordinary feature implementation inside an already-defined workflow
- the issue is a one-off bug with no framework-level implications
- higher-authority artifacts already fully determine the correct behavior

## Inputs

- audit scope and target artifacts
- relevant sources in authority order
- any known operator pain points, ambiguity, or repeated agent failures
- recent framework changes that may have introduced drift

## Outputs

- a concise audit summary
- prioritized findings with rationale
- recommended remediation paths tied to concrete artifacts
- explicit no-change conclusions where the framework is already adequate

## Workflow

1. Define the audit boundary before collecting evidence.
2. Read the governing sources in authority order instead of starting from lower-order summaries.
3. Check consistency top-down: schema and policy first, then interfaces, playbooks, docs, and the `ai/` bundle.
4. Check efficiency: duplicated instructions, dead routing, unnecessary reading cost, or avoidable procedural steps.
5. Check predictability: whether two competent agents would likely make the same decision from the same inputs.
6. Report findings as concrete framework work items, not as abstract criticism.

## Decision Rules

- Prefer contradiction findings over style opinions.
- Prefer recurring operator or agent friction over isolated awkwardness.
- Prefer explicit decision rules over prose that depends on interpretation.
- Do not invent new policy when the current authority ladder already answers the question.

## Escalate When

- fixing a finding would change governance authority or merge policy
- the framework lacks a canonical source for a disputed behavior
- a proposed fix would grant new automation authority without explicit support

## Completion Criteria

- the audit scope is explicit
- findings are tied to concrete artifacts
- recommended remediations are actionable
- unresolved governance questions are called out clearly

## Canonical References

- `AGENTS.md`
- `README.md`
- `docs/AI_NATIVE_FRAMEWORK.md`
- `ai/playbooks/framework-review.md`
