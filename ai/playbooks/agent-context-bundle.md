# Agent context bundle

## Objective

Install and maintain a repository-local runtime standard for agents:

- **`AGENTS.md` at the repository root** — sole agent file outside `ai/`; bootstrap, authority, and commands
- **`ai/` directory** — every other agent-facing artifact: playbook index, playbooks, skill index, skills, and memory

Typical layout inside `ai/`:

- `PLAYBOOKS.md` for playbook discovery
- `playbooks/` for unitary step-by-step procedures
- `SKILLS.md` for role- and task-oriented skill routing
- `skills/` for deeper skill bodies loaded on demand
- `MEMORY.md` for durable operating memory

This playbook makes agent behavior inspectable, versioned, and portable across coding environments. It complements the repository foundation and pull request execution playbooks by defining how an agent enters the repository, how it chooses a procedure or skill, and how it preserves durable context between sessions. Specs, policy, and playbooks remain the durable operating system; `AGENTS.md` plus `ai/` are the bootstrap surface that points agents toward them.

## When to run

Run it in any repository that expects repeated agent participation. If you are adopting the full framework on a new repository, apply repository foundation first so CI and protection match what the bundle describes; the suggested order is documented in `ai/PLAYBOOKS.md`.

Re-run it whenever:

- the authority ladder changes
- canonical commands change
- key playbooks are added or retired
- architecture or terminology changes enough to invalidate current memory
- an agent repeatedly makes the same bootstrap mistake because repository context is not explicit enough

## Outcomes

At the end of this playbook, the repository should have:

- a root `AGENTS.md` file that tells an agent how to enter and operate in the repo
- an `ai/` directory containing `SKILLS.md`, `PLAYBOOKS.md`, `MEMORY.md`, and usually `skills/` and `playbooks/`
- links from the framework docs and README to `AGENTS.md` and `ai/`
- lightweight maintenance rules so the bundle stays accurate instead of becoming prompt theater

## Inputs

- Repository purpose and scope
- Authority ladder and normative sources
- Canonical setup, validation, test, and release commands
- Playbook inventory
- Important glossary and architectural facts
- Current open loops worth preserving across sessions

## Procedure

### 1. Create root `AGENTS.md`

`AGENTS.md` is the first file a new agent should read.

It should include:

- Repository purpose in one paragraph
- Authority ladder and which files override which
- Canonical commands the agent should run before and after changes
- Expected work style for this repository
- Rules for editing, validation, and escalation
- A short map of important directories and docs (including `ai/`)

`AGENTS.md` should stay concise. If it grows into a handbook, move detail into linked docs and keep `AGENTS.md` as the bootstrap surface.

### 2. Create `ai/` and `ai/SKILLS.md`

`ai/SKILLS.md` is the skill index and routing layer.

Each skill entry should declare:

- Name
- Trigger or when to use it
- Inputs required
- Outputs expected
- What file or canonical source to load next
- Constraints or escalation rules

`ai/SKILLS.md` should stay index-shaped. Full skill bodies belong in `ai/skills/*.md` once a workflow is rich enough to need more than a few lines. In a framework-aligned repository, the skill index typically points at the repository foundation and pull request execution playbooks among its default entries. Add more skills only when the workflow is recurring enough to justify a reusable unit.

### 2.5 Create `ai/skills/`

Use `ai/skills/` for the on-demand skill bodies referenced by `ai/SKILLS.md`.

Each skill file should stay operational:

- purpose
- when to use it
- when not to use it
- inputs
- outputs
- workflow steps
- decision rules
- escalation conditions
- completion criteria

This split keeps the cost of loading the indices low while still giving agents a deeper execution harness when they need it.

### 2.6 Create `ai/PLAYBOOKS.md` and `ai/playbooks/`

Use `ai/PLAYBOOKS.md` as the discovery index for unitary procedures. Store each procedure body as a file under `ai/playbooks/`, the same way skill bodies live under `ai/skills/`.

### 3. Create `ai/MEMORY.md`

`ai/MEMORY.md` is durable operating memory, not a raw transcript.

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

- README links to root `AGENTS.md` and to `ai/` (indices and subfolders)
- `ai/PLAYBOOKS.md` indexes every versioned playbook under `ai/playbooks/` (including this one)
- framework prose recognizes `AGENTS.md` and `ai/` as repository-local context, subordinate to schema and policy

### 5. Review for contradictions

Before considering this playbook complete:

1. Check that `AGENTS.md`, `ai/SKILLS.md`, `ai/skills/*.md`, and `ai/MEMORY.md` do not contradict schema, policy, or playbooks.
2. Check that canonical commands still work.
3. Check that every named skill points to a real canonical source.
4. Remove stale facts and open loops.

## Maintenance rules

- `AGENTS.md` changes when repo authority, commands, workflow, or escalation rules change.
- `ai/SKILLS.md` changes when the skill routing index changes.
- `ai/skills/*.md` changes when a recurring workflow is added, retired, or materially changed.
- `ai/PLAYBOOKS.md` and `ai/playbooks/*.md` change when procedures are added, retired, or materially changed.
- `ai/MEMORY.md` changes when a durable fact changes, a decision is made, or an open loop is closed or created.
- After any non-trivial completed workflow, evaluate whether the work produced durable learnings that should update `ai/MEMORY.md`, `ai/SKILLS.md`, `ai/skills/*.md`, `AGENTS.md`, or a playbook under `ai/playbooks/` before the task is treated as fully closed.
- Temporary working notes should graduate into schema, playbooks, or code comments when they become durable policy.

## Recommended template discipline

Prefer this shape:

- `AGENTS.md` at repo root: short and directive
- `ai/SKILLS.md`: index-shaped and reusable
- `ai/skills/`: detailed only where the selected workflow needs it
- `ai/PLAYBOOKS.md`: index-shaped procedure routing
- `ai/playbooks/`: unitary procedures only
- `ai/MEMORY.md`: structured, pruned, and date-aware

Avoid:

- provider-specific hidden prompt assumptions
- dumping chat transcripts into memory
- duplicating entire playbooks in the skill registry
- using memory as a backlog substitute when an issue tracker exists

## Notes for future variants

- This playbook should eventually gain a machine-readable schema under `spec/processes/`.
- Multi-agent systems may also introduce `agents/*.md` capability files, but root `AGENTS.md` should remain the universal first-read surface.
