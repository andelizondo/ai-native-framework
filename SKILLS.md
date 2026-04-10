# SKILLS.md

This file maps recurring repository work to reusable procedures. Use it to decide how to operate before improvising a new workflow.

## How To Use This File

1. Match the task to the closest skill.
2. Read the linked canonical source.
3. Use the prescribed inputs, outputs, and constraints.
4. If no skill fits, perform the task conservatively and consider whether a new skill should be added after the work is complete.

## Skill Registry

### Framework Bootstrap

- **When to use:** orienting a new agent or starting substantial work in this repository
- **Inputs:** repository purpose, current task, affected files
- **Outputs:** correct read order, authority map, and validation plan
- **Canonical sources:** `AGENTS.md`, `README.md`, `docs/AI_NATIVE_FRAMEWORK_COMPLETE.md`
- **Notes:** use this before making policy or playbook changes

### P0 - Repository Foundation

- **When to use:** establishing or auditing repository governance, CI, branch protection, security defaults, and contributor surfaces
- **Inputs:** repository owner, default branch, canonical validation command, maintainer identity
- **Outputs:** governed repo baseline and recorded settings
- **Canonical source:** `docs/P0_REPOSITORY_FOUNDATION.md`
- **Constraints:** do not guess required check names; read real emitted checks

### P1 - Pull Request Execution Loop

- **When to use:** designing, implementing, or reviewing PR automation, risk policy, branch freshness, or merge authority behavior
- **Inputs:** PR metadata, labels, required checks, review state, branch freshness state, threshold policy
- **Outputs:** residual-risk decision, merge authority, or structured escalation request
- **Canonical source:** `docs/P1_PR_EXECUTION_LOOP.md`
- **Constraints:** machines verify, humans decide; do not convert timing gaps into human-review work

### P2 - Agent Context Bundle

- **When to use:** creating or updating `AGENTS.md`, `SKILLS.md`, `MEMORY.md`, or making agent bootstrap behavior explicit in a repository
- **Inputs:** authority ladder, canonical commands, playbooks, glossary, durable facts, open loops
- **Outputs:** maintained agent runtime bundle
- **Canonical source:** `docs/P2_AGENT_CONTEXT_BUNDLE.md`
- **Constraints:** keep the bundle concise and subordinate to schema and policy

### Spec Evolution

- **When to use:** changing framework structure, required fields, or examples under `spec/`
- **Inputs:** desired behavioral change, schema updates, example updates, policy impact
- **Outputs:** aligned schema, examples, and documentation
- **Canonical sources:** `spec/schema/product-spec.schema.json`, `spec/examples/`, `docs/AI_NATIVE_FRAMEWORK_COMPLETE.md`
- **Constraints:** avoid spec theater; machine validation is the source of truth

### Interface Evolution

- **When to use:** changing logical tool contracts or capability boundaries
- **Inputs:** workflow need, capability boundary, interface change rationale
- **Outputs:** updated `agents/interfaces.yaml` and aligned docs
- **Canonical sources:** `agents/interfaces.yaml`, `docs/AI_NATIVE_FRAMEWORK_COMPLETE.md`
- **Constraints:** express capabilities, not mascots or vendor-specific personas

## Adding A New Skill

Add a skill when all of these are true:

- the workflow recurs
- the workflow has a stable trigger
- there is a canonical source worth pointing to
- reusing the procedure reduces ambiguity or failure rate

For each new skill, include:

- when to use it
- required inputs
- expected outputs
- canonical source
- constraints or escalation rules
