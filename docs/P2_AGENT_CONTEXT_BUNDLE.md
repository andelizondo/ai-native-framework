# P2 - Agent context bundle

## Objective

Install and maintain a repository-local runtime standard for agents using three explicit files:

- `AGENTS.md` for bootstrap and authority
- `SKILLS.md` for reusable procedures
- `MEMORY.md` for durable operating memory

P2 makes agent behavior inspectable, versioned, and portable across coding environments. It complements P0 and P1 by defining how an agent enters the repository, how it chooses a procedure, and how it preserves durable context between sessions.

## When to run

Run P2 immediately after P0 in any repository that expects repeated agent participation.

Re-run P2 whenever:

- the authority ladder changes
- canonical commands change
- key playbooks are added or retired
- architecture or terminology changes enough to invalidate current memory
- an agent repeatedly makes the same bootstrap mistake because repository context is not explicit enough

## Outcomes

At the end of this playbook, the repository should have:

- a root `AGENTS.md` file that tells an agent how to enter and operate in the repo
- a root `SKILLS.md` file that maps recurring work to reusable procedures
- a root `MEMORY.md` file that stores stable operational context and current open loops
- links from the framework docs and README to the bundle
- lightweight maintenance rules so the bundle stays accurate instead of becoming prompt theater

## Inputs

- Repository purpose and scope
- Authority ladder and normative sources
- Canonical setup, validation, test, and release commands
- Playbook inventory
- Important glossary and architectural facts
- Current open loops worth preserving across sessions

## Procedure

### 1. Create `AGENTS.md`

`AGENTS.md` is the first file a new agent should read.

It should include:

- Repository purpose in one paragraph
- Authority ladder and which files override which
- Canonical commands the agent should run before and after changes
- Expected work style for this repository
- Rules for editing, validation, and escalation
- A short map of important directories and docs

`AGENTS.md` should stay concise. If it grows into a handbook, move detail into linked docs and keep `AGENTS.md` as the bootstrap surface.

### 2. Create `SKILLS.md`

`SKILLS.md` is the procedure index.

Each skill entry should declare:

- Name
- Trigger or when to use it
- Inputs required
- Outputs expected
- Canonical references
- Constraints or escalation rules

Skills should reference the canonical playbook rather than duplicating it. P0 and P1 are default skills in a framework-aligned repository. Add more skills only when the workflow is recurring enough to justify a reusable unit.

### 3. Create `MEMORY.md`

`MEMORY.md` is durable operating memory, not a raw transcript.

It should contain:

- Stable facts about the repository
- Current framework and playbook status
- Open loops that matter across sessions
- Decision notes with dates
- Glossary terms that an agent is likely to misread without help

It must separate durable memory from temporary notes. Resolved tasks, noisy logs, and transient debugging detail should be removed instead of accumulated indefinitely.

### 4. Link the bundle into the framework

Update README, playbook indexes, and framework docs so the bundle is part of the operating system rather than an undocumented convention.

At minimum:

- README links to `AGENTS.md`, `SKILLS.md`, and `MEMORY.md`
- `docs/PLAYBOOKS.md` includes P2
- framework prose recognizes the bundle as repository-local context, subordinate to schema and policy

### 5. Review for contradictions

Before closing P2:

1. Check that `AGENTS.md`, `SKILLS.md`, and `MEMORY.md` do not contradict schema, policy, or playbooks.
2. Check that canonical commands still work.
3. Check that every named skill points to a real canonical source.
4. Remove stale facts and open loops.

## Maintenance rules

- `AGENTS.md` changes when repo authority, commands, workflow, or escalation rules change.
- `SKILLS.md` changes when a recurring workflow is added, retired, or materially changed.
- `MEMORY.md` changes when a durable fact changes, a decision is made, or an open loop is closed or created.
- Temporary working notes should graduate into schema, playbooks, or code comments when they become durable policy.

## Recommended template discipline

Prefer this shape:

- `AGENTS.md`: short and directive
- `SKILLS.md`: index-shaped and reusable
- `MEMORY.md`: structured, pruned, and date-aware

Avoid:

- provider-specific hidden prompt assumptions
- dumping chat transcripts into memory
- duplicating entire playbooks in the skill registry
- using memory as a backlog substitute when an issue tracker exists

## Notes for future variants

- P2 should eventually gain a machine-readable schema under `spec/processes/`.
- Large repositories may split `SKILLS.md` into an index plus a `skills/` directory.
- Multi-agent systems may also introduce `agents/*.md` capability files, but the root bundle should remain the universal bootstrap surface.