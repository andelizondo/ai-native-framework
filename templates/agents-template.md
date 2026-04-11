# AGENTS.md template

## Purpose

[One paragraph: what this repository is for and why agents operate here.]

**Recommended layout:** keep **`AGENTS.md` at the repository root** as the only agent file there; put playbook indices, playbooks, skill indices, skills, and memory under **`ai/`** (see the canonical framework repo for a full example).

## Read Order

1. `README.md`
2. [Primary framework or architecture doc]
3. `ai/PLAYBOOKS.md` (or your playbook index path)
4. [Task-specific playbooks under `ai/playbooks/` or specs]
5. `ai/SKILLS.md`
6. Only the specific `ai/skills/*.md` files selected from `ai/SKILLS.md`
7. `ai/MEMORY.md`

## Authority Ladder

1. [Machine-validated schema]
2. [Validated instances]
3. [Policy files]
4. [Interface contracts]
5. `ai/playbooks/*.md` (procedure bodies)
6. [Explanatory docs, e.g. `docs/*`]
7. `AGENTS.md`, `ai/PLAYBOOKS.md`, `ai/SKILLS.md`, `ai/skills/*.md`, `ai/MEMORY.md`

## Canonical Commands

- Install: `[install command]`
- Validate: `[validation command]`
- Test: `[test command if distinct]`

## Working Rules

- [Rule]
- [Rule]
- [Rule]

## Change Discipline

- When adding a new recurring workflow, update `ai/PLAYBOOKS.md`, `ai/playbooks/` as needed, and `ai/SKILLS.md`.
- When changing repo operating rules, check whether `AGENTS.md` and `ai/MEMORY.md` now need updates.
- When introducing durable process knowledge, prefer a playbook under `ai/playbooks/` or a schema-backed artifact over burying it in memory.

## Escalation Conditions

- [Condition]
- [Condition]
- [Condition]

## Important Paths

- `[path]` - [purpose]
- `[path]` - [purpose]
- `[path]` - [purpose]

## Definition Of Done

A framework change is not complete if it leaves the agent bundle under `ai/` stale. If your edit changes how an agent should bootstrap, choose a skill or playbook, validate work, or preserve context, update `AGENTS.md`, `ai/PLAYBOOKS.md`, `ai/SKILLS.md`, `ai/skills/`, `ai/playbooks/`, or `ai/MEMORY.md` in the same change as appropriate.
