# Feature Request: [Feature Name]

<!--
  This template is the intake form for any new dashboard feature.
  Fill it out before asking an agent to implement.
  An agent implementing from this template will follow ai/playbooks/feature-implementation.md.

  The spec-first discipline is non-negotiable:
    1. Fill out this template (events section required)
    2. Agent updates spec/examples/ and lib/analytics/events.ts
    3. Agent implements the component
    4. npm run validate must pass before the PR ships
-->

## What it does

<!-- One to two sentences. User-facing description. -->

## User action

<!--
  The specific thing a user does that makes this feature meaningful.
  Be concrete. "User clicks X to do Y" is better than "user can interact with Z."
-->

## Where it lives in the UI

<!--
  Route and component area.
  Example: "Button in the top-right of /design page, inside the existing TopBar component."
  Example: "New card below the Hello World card on the home route (/)."
-->

## Acceptance criteria

<!--
  Short, verifiable list. Each item should be checkable by a person or an automated test.
  Example:
  - [ ] Button renders on /design
  - [ ] Clicking it opens a modal
  - [ ] Modal closes on Escape key
  - [ ] spec.exported event appears in PostHog after export
-->

- [ ]
- [ ]

## Events this feature emits

<!--
  At least one event. This section is required — it drives the spec update and the type registry.
  Name the event using the taxonomy: domain.action_past_tense
  Key property: the single most important thing to know about this action (no PII).

  Example:
  | Event | Trigger | Key property |
  | spec.exported | User clicks Export | format: yaml|json|pdf |

  If you are not sure of the event name, describe what happens and the agent will name it per policy.
-->

| Event | Trigger | Key property |
|-------|---------|--------------|
|       |         |              |

## Core metric this feature contributes to

<!--
  Which PostHog metric (from the spec's observability.metrics) does this feature affect?
  Or name a new one if this feature introduces a new signal worth tracking long-term.
  Example: "dashboard.phase_navigated — measures which phases receive attention"
-->

## Non-goals for this iteration

<!--
  Explicit scope limit. Prevents scope creep during implementation.
  Example: "Does not persist the exported file to a backend — download only."
-->

-

## Data / backend requirements

<!--
  Does this feature need a new API route, database access, or external service?
  If none, write "None — client-side only."
-->

## Risks and open questions

<!--
  Anything the implementer should know before starting.
  Leave blank if none.
-->
