# SKILLS.md

This file is the skill discovery index for the repository-local agent context bundle. Read it to decide which skill to load, then open only the specific `skills/*.md` file or canonical playbook needed for the current task.

## How To Use This File

1. Match the task to the closest skill or playbook entry below.
2. Open only the linked skill file or canonical source for the selected entry.
3. Load deeper references only when the selected skill says they are needed.
4. If no entry fits, work conservatively and consider whether the workflow deserves a new skill after the task is complete.

Discovery should stay broad and cheap. Execution should stay narrow and deep.

## Skill Index

### Framework Bootstrap

- **When to use:** orienting a new agent or starting substantial work in this repository
- **Inputs:** repository purpose, current task, affected files
- **Outputs:** correct read order, authority map, and validation plan
- **Load:** `AGENTS.md`, `README.md`, `docs/AI_NATIVE_FRAMEWORK.md`
- **Notes:** use this before making policy, playbook, or workflow changes

### Designer

- **When to use:** creating or refining visual assets, brand elements, and design directions
- **Inputs:** goal, brand intent, target surface, references, human feedback
- **Outputs:** concrete design directions, selected asset, implementation-ready handoff
- **Load:** `skills/designer.md`

### PM

- **When to use:** shaping a requested change into scope, rationale, acceptance criteria, and implementation guidance
- **Inputs:** goal, constraints, selected concept, affected surfaces
- **Outputs:** concise change brief, scope, non-goals, acceptance criteria
- **Load:** `skills/pm.md`

### Developer

- **When to use:** implementing repository changes and carrying them through validation, PR review, and merge under P1
- **Inputs:** approved scope, affected files, repository constraints, live PR state
- **Outputs:** implementation, verification evidence, review closure, published PR state
- **Load:** `skills/developer.md`

### P0 - Repository Foundation

- **When to use:** establishing or auditing repository governance, CI, branch protection, security defaults, and contributor surfaces
- **Inputs:** repository owner, default branch, canonical validation command, maintainer identity
- **Outputs:** governed repo baseline and recorded settings
- **Load:** `docs/P0_REPOSITORY_FOUNDATION.md`
- **Constraints:** do not guess required check names; read real emitted checks

### P1 - Pull Request Execution Loop

- **When to use:** designing, implementing, or reviewing PR automation, risk policy, branch freshness, or merge authority behavior
- **Inputs:** PR metadata, labels, required checks, review state, branch freshness state, threshold policy
- **Outputs:** residual-risk decision, merge authority, or structured escalation request
- **Load:** `docs/P1_PR_EXECUTION_LOOP.md`
- **Constraints:** machines verify, humans decide; do not convert timing gaps into human-review work

### P2 - Agent Context Bundle

- **When to use:** creating or updating `AGENTS.md`, `SKILLS.md`, `skills/*.md`, `MEMORY.md`, or making agent bootstrap behavior explicit in a repository
- **Inputs:** authority ladder, canonical commands, playbooks, glossary, durable facts, open loops
- **Outputs:** maintained agent runtime bundle
- **Load:** `docs/P2_AGENT_CONTEXT_BUNDLE.md`
- **Constraints:** keep the bundle concise, index-shaped at the root, and subordinate to schema and policy

### Spec Evolution

- **When to use:** changing framework structure, required fields, or examples under `spec/`
- **Inputs:** desired behavioral change, schema updates, example updates, policy impact
- **Outputs:** aligned schema, examples, and documentation
- **Load:** `spec/schema/product-spec.schema.json`, `spec/examples/`, `docs/AI_NATIVE_FRAMEWORK.md`
- **Constraints:** avoid spec theater; machine validation is the source of truth

### Interface Evolution

- **When to use:** changing logical tool contracts or capability boundaries
- **Inputs:** workflow need, capability boundary, interface change rationale
- **Outputs:** updated `agents/interfaces.yaml` and aligned docs
- **Load:** `agents/interfaces.yaml`, `docs/AI_NATIVE_FRAMEWORK.md`
- **Constraints:** express capabilities, not mascots or vendor-specific personas

## Adding A New Skill

Add a new `skills/*.md` file when all of these are true:

- the workflow recurs
- the workflow has a stable trigger
- the workflow benefits from a reusable operating harness
- loading the skill only when needed will save ambiguity or token cost

For each new skill:

- keep `SKILLS.md` as the discovery pointer, not the full body
- make the skill file operational and concise
- include triggers, inputs, outputs, workflow steps, decision rules, escalations, and completion criteria
- point to the canonical docs or playbooks the skill relies on
