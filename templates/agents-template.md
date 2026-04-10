# AGENTS.md template

## Purpose

[One paragraph: what this repository is for and why agents operate here.]

## Read Order

1. `README.md`
2. [Primary framework or architecture doc]
3. [Playbook index]
4. [Task-specific canonical docs]
5. `SKILLS.md`
6. `MEMORY.md`

## Authority Ladder

1. [Machine-validated schema]
2. [Validated instances]
3. [Policy files]
4. [Interface contracts]
5. [Playbooks and docs]
6. `AGENTS.md`, `SKILLS.md`, `MEMORY.md`

## Canonical Commands

- Install: `[install command]`
- Validate: `[validation command]`
- Test: `[test command if distinct]`

## Working Rules

- [Rule]
- [Rule]
- [Rule]

## Change Discipline

- When adding a new recurring workflow, update [playbook index] and `SKILLS.md`.
- When changing repo operating rules, check whether `AGENTS.md` and `MEMORY.md` now need updates.
- When introducing durable process knowledge, prefer a playbook or schema-backed artifact over burying it in memory.

## Escalation Conditions

- [Condition]
- [Condition]
- [Condition]

## Important Paths

- `[path]` - [purpose]
- `[path]` - [purpose]
- `[path]` - [purpose]

## Definition Of Done

A framework change is not complete if it leaves the runtime bundle stale. If your edit changes how an agent should bootstrap, choose a skill, validate work, or preserve context, update this bundle in the same change.
