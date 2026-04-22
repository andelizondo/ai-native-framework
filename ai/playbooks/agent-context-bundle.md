# Agent context bundle

## Use When

- creating or maintaining root `AGENTS.md`
- creating or maintaining files under `ai/`
- tightening agent bootstrap, routing, or memory behavior

## Inputs

- repo purpose and scope
- authority ladder
- canonical commands
- playbook and skill inventory
- durable facts and open loops

## Outputs

- concise root `AGENTS.md`
- compact `ai/SKILLS.md` and `ai/PLAYBOOKS.md`
- on-demand `ai/skills/*.md` and `ai/playbooks/*.md`
- pruned `ai/MEMORY.md`

## Steps

1. Keep `AGENTS.md` as the bootstrap contract: purpose, authority, commands, rules, escalation, important paths.
2. Keep `ai/SKILLS.md` and `ai/PLAYBOOKS.md` index-shaped: when to use, inputs, outputs, load, constraints.
3. Put operating detail in `ai/skills/*.md` and `ai/playbooks/*.md`, not in the indices.
4. Keep `ai/MEMORY.md` to durable facts, open loops, and dated decisions; remove transient history.
5. Update README and other routing docs when the bundle shape changes.
6. Before closing, check for contradictions with higher-order artifacts and remove stale pointers.

## Constraints

- keep the bundle subordinate to schema, policy, interfaces, and playbooks
- prefer pointers over duplicated prose
- do not let memory become a transcript or backlog substitute

## Template

- Skill file: `Use When`, `Inputs`, `Outputs`, `Steps`, `Rules`, `Escalate When`, `Done`, `References`
- Playbook file: `Use When`, `Inputs`, `Outputs`, `Steps`, `Constraints`, `References`

## References

- `AGENTS.md`
- `README.md`
- `ai/SKILLS.md`
- `ai/PLAYBOOKS.md`
- `ai/MEMORY.md`
