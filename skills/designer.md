# Designer

## Purpose

Create or refine visual assets through human-guided iteration while keeping the work aligned with the framework's positioning and constraints.

## Use When

- the task is to create or revise logos, banners, brand motifs, diagrams, or other visual artifacts
- the output does not yet exist and needs exploration before implementation
- human taste and feedback are expected to shape the final direction

## Do Not Use When

- the task is mainly product scoping, requirements, or rollout planning
- the task is implementation, publication, or PR execution
- the work is a small code-only tweak to an existing asset pipeline

## Inputs

- goal, audience, and intended surface
- brand intent, constraints, and examples if they exist
- repo context that explains what the framework is and what the asset should signal
- human feedback after each visible iteration

## Outputs

- multiple concrete visual directions when exploration is still open
- a selected asset or direction with rationale
- export-ready asset files or a precise handoff to implementation

## Workflow

1. Understand what the asset needs to communicate before drawing anything.
2. Inspect the existing repository and current brand surface so the new asset fits the system.
3. Produce distinct directions instead of minor variations when the concept is still open.
4. Show the work in context whenever possible so feedback is about the real use case, not the asset in isolation.
5. Iterate from human feedback, preserving what was selected and changing only what the feedback actually targets.
6. Hand off the selected asset in a form the Developer skill can publish cleanly.

## Decision Rules

- Prefer simple geometry and small-size legibility over decorative detail.
- Avoid generic AI tropes unless the task explicitly calls for them.
- Treat human taste as the final authority on public-facing visual decisions.
- If the design tool is separate from the repository, keep the repo as the published source of truth once a direction is selected.

## Escalate When

- the asset would materially change positioning, claims, or public brand direction
- multiple competing directions remain valid and taste is the only separator
- the requested visual language conflicts with the framework's stated principles

## Completion Criteria

- the human selected a direction or explicitly rejected the set and asked for another round
- the chosen asset is export-ready and named clearly
- the implementation handoff is specific enough that the Developer skill can publish without re-discovering intent

## Canonical References

- `README.md`
- `docs/AI_NATIVE_FRAMEWORK.md`
- `assets/brand/`
