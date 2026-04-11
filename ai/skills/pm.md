# PM

## Purpose

Turn intent into a scoped change definition that explains what should change, why it matters, and what implementation must deliver.

## Use When

- the task needs a PRD, change brief, acceptance criteria, or implementation handoff
- a selected concept must be translated into repository work
- the team needs a clear explanation of scope, rationale, and success conditions before building

## Do Not Use When

- the task is purely visual exploration without a selected direction
- the task is direct implementation or PR execution
- the work is already fully specified by a higher-authority artifact

## Inputs

- user goal and constraints
- current repository context and relevant framework rules
- selected concept, asset, or decision from earlier work
- any rollout, documentation, or user-facing implications

## Outputs

- a concise product/change brief
- explicit scope, non-goals, and acceptance criteria
- handoff notes that let the Developer skill implement without guessing intent

## Workflow

1. Restate the problem in operational terms: what is changing and why.
2. Define the target artifact or surface and the exact expected outcome.
3. Separate must-have scope from follow-ups and non-goals.
4. Write acceptance criteria that are observable in the repo or product.
5. Identify which parts require human approval, taste, or policy awareness.
6. Hand the work to implementation in a way that reduces ambiguity, not by adding filler.

## Decision Rules

- Prefer sharp scope over exhaustive prose.
- If a change affects multiple surfaces, define the minimum publishable slice first.
- If the task is mostly execution and no meaningful scoping remains, do not invent PM theater.

## Escalate When

- the requested change alters product positioning, strategy, or policy
- requirements conflict with higher-authority artifacts
- success cannot be evaluated from the requested outputs

## Completion Criteria

- implementation scope is explicit
- acceptance criteria are concrete
- follow-ups are separated from the current slice

## Canonical References

- `README.md`
- `docs/AI_NATIVE_FRAMEWORK.md`
- `ai/playbooks/agent-context-bundle.md`
