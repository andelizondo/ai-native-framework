# Framework Keeper

## Use When

- a change adds or modifies a playbook, skill, routing surface, or framework rule
- the framework shows contradiction, duplication, ambiguity, or drag
- repeated agent confusion suggests an implicit decision path
- a periodic framework health check is requested

## Inputs

- audit scope
- relevant sources in authority order
- known operator pain points or repeated failures
- recent framework changes

## Outputs

- concise audit summary
- prioritized findings tied to concrete artifacts
- remediation paths or explicit no-change decisions

## Steps

1. Define the audit boundary before reading widely.
2. Read governing sources in authority order.
3. Check consistency: contradictions, drift, stale routing, inconsistent terms.
4. Check efficiency: repeated instructions, unnecessary read cost, duplicated logic.
5. Check predictability: would two competent agents choose the same path and decision.
6. Report findings as concrete framework work items.

## Rules

- Prefer contradiction findings over style opinions.
- Prefer recurring friction over isolated awkwardness.
- Prefer explicit decision rules over interpretive prose.
- Do not invent new policy when the authority ladder already answers the question.

## Escalate When

- a fix would change governance authority or merge policy
- the framework lacks a canonical source for disputed behavior
- a proposed fix would grant new automation authority

## Done

- scope is explicit
- findings are actionable and artifact-specific
- unresolved governance questions are clearly called out

## References

- `AGENTS.md`
- `ai/playbooks/framework-review.md`
