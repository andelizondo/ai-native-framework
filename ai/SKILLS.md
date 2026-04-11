# SKILLS.md

This file is the skill discovery index for the repository-local agent bundle under **`ai/`** (root `AGENTS.md` is the only agent file outside this folder). Read it to decide which skill to load, then open only the specific `skills/*.md` file next to this index or a playbook under `playbooks/` for the current task. For playbook routing alone, you may start from `PLAYBOOKS.md` in this directory instead.

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
- **Load:** `AGENTS.md`, `README.md`, `docs/AI_NATIVE_FRAMEWORK.md`, `PLAYBOOKS.md` (in this directory)
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

- **When to use:** implementing repository changes and carrying them through validation, PR review, and merge per the pull request execution playbook
- **Inputs:** approved scope, affected files, repository constraints, live PR state
- **Outputs:** implementation, verification evidence, review closure, published PR state
- **Load:** `skills/developer.md`

### Framework Keeper

- **When to use:** auditing the framework itself for contradiction, duplication, unnecessary complexity, or underspecified decision paths
- **Inputs:** audit scope, relevant authoritative artifacts, known operator pain points, recent framework changes
- **Outputs:** structured findings, recommended remediations, and explicit decisions on what should remain unchanged
- **Load:** `skills/framework-keeper.md`

### Repository foundation (playbook)

- **When to use:** establishing or auditing repository governance, CI, branch protection, security defaults, and contributor surfaces
- **Inputs:** repository owner, default branch, canonical validation command, maintainer identity
- **Outputs:** governed repo baseline and recorded settings
- **Load:** `playbooks/repository-foundation.md`
- **Constraints:** do not guess required check names; read real emitted checks

### Pull request execution loop (playbook)

- **When to use:** designing, implementing, or reviewing PR automation, risk policy, branch freshness, or merge authority behavior
- **Inputs:** PR metadata, labels, required checks, review state, branch freshness state, threshold policy
- **Outputs:** residual-risk decision, merge authority, or structured escalation request
- **Load:** `playbooks/pull-request-execution-loop.md`
- **Constraints:** machines verify, humans decide; do not convert timing gaps into human-review work

### Agent context bundle (playbook)

- **When to use:** creating or updating root `AGENTS.md`, or files under `ai/` (`SKILLS.md`, `skills/*.md`, `MEMORY.md`, `PLAYBOOKS.md`, `playbooks/`), or making agent bootstrap behavior explicit in a repository
- **Inputs:** authority ladder, canonical commands, playbooks, glossary, durable facts, open loops
- **Outputs:** maintained agent runtime bundle (`AGENTS.md` + `ai/`)
- **Load:** `playbooks/agent-context-bundle.md`
- **Constraints:** keep the bundle concise, index-shaped inside `ai/`, and subordinate to schema and policy

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

Add a new `ai/skills/*.md` file when all of these are true:

- the workflow recurs
- the workflow has a stable trigger
- the workflow benefits from a reusable operating harness
- loading the skill only when needed will save ambiguity or token cost

For each new skill:

- keep `ai/SKILLS.md` as the discovery pointer, not the full body
- make the skill file operational and concise
- include triggers, inputs, outputs, workflow steps, decision rules, escalations, and completion criteria
- point to the canonical docs or playbooks the skill relies on
