# Framework review

## Use When

- a playbook, skill, routing surface, or framework rule changed
- repeated agent confusion suggests contradiction or underspecification
- a periodic framework audit is requested

## Inputs

- audit scope
- authoritative sources in ladder order
- recent framework changes
- known operator or agent pain points

## Outputs

- clear audit boundary
- findings by contradiction, duplication, ambiguity, routing gap, or drag
- concrete remediation paths and no-change calls

## Steps

1. Define the smallest coherent audit boundary.
2. Read relevant artifacts in authority order.
3. Check consistency across artifacts.
4. Check efficiency: repeated instructions, unnecessary loading, dead routing.
5. Check predictability: same inputs should lead to the same workflow and decision.
6. Report findings with governing source, affected artifact, risk, and smallest coherent fix.

## Constraints

- audit the framework, not ordinary feature code
- do not weaken higher-order artifacts to satisfy lower-order drift
- treat memory and indices as supporting surfaces

## References

- `AGENTS.md`
- `ai/PLAYBOOKS.md`
- `ai/SKILLS.md`
