# Framework review

## Objective

Audit the framework itself for consistency, efficiency, and predictability so the operating system remains coherent, lean, and reproducible for both humans and agents.

This playbook exists for framework review work only. It is not a generic code review procedure.

## When to run

Run it when:

- a change adds or materially alters a playbook, skill, authority rule, routing surface, or framework policy
- repeated agent confusion suggests the framework is underspecified or contradictory
- the repository needs a periodic framework health check
- a human explicitly asks whether the framework has accumulated ambiguity, duplication, or unnecessary complexity

## Outcomes

At the end of this playbook, the repository should have:

- a clear audit boundary
- findings categorized by contradiction, duplication, unnecessary complexity, ambiguity, or routing gap
- concrete remediation options tied to the right artifact layer
- explicit no-change decisions where the current framework is already sufficient

## Inputs

- target scope or changed files
- authoritative sources in ladder order
- recent framework decisions or bundle changes
- known operator or agent pain points

## Procedure

### 1. Define the audit boundary

State exactly what is being audited before reading widely:

- a specific workflow
- a specific surface such as the `ai/` bundle
- a cross-cutting framework concern such as merge authority, routing, or bootstrap behavior

If the scope is too broad to evaluate concretely, reduce it to the smallest coherent framework slice.

### 2. Gather governing sources in authority order

Read the relevant sources from highest to lowest authority:

1. `spec/schema/*`
2. validated artifacts under `spec/examples/*` and future `spec/processes/*`
3. `spec/policy/*`
4. `agents/interfaces.yaml`
5. `ai/playbooks/*.md`
6. `docs/*`
7. `AGENTS.md`, `ai/PLAYBOOKS.md`, `ai/SKILLS.md`, `ai/skills/*.md`, `ai/MEMORY.md`

Do not start from lower-order summaries and then rationalize contradictions upward.

### 3. Check consistency

Inspect whether:

- lower-order artifacts contradict higher-order ones
- the same workflow is described differently in different files
- important terms are used with inconsistent meaning
- routing files point to artifacts that no longer match reality

Consistency findings should identify both the source of truth and the drift location.

### 4. Check efficiency

Inspect whether:

- instructions are duplicated across multiple files without adding value
- agents are forced to read more than necessary to act correctly
- the framework repeats the same reconciliation work in multiple surfaces
- a lower-value artifact should instead be replaced with a pointer to a higher-value one

Efficiency findings should focus on reducing operating cost, not on prose preferences.

### 5. Check predictability

Inspect whether:

- triggers are explicit enough that agents will choose the same workflow
- decision rules are explicit enough that agents will reach the same conclusion
- escalation points are clear instead of inferred
- completion criteria are concrete instead of rhetorical

If two competent agents could reasonably produce different behavior from the same inputs, treat that as a predictability gap.

### 6. Report findings and remediation paths

For each finding, record:

- category
- severity
- governing source
- affected artifact
- why the current state creates risk or drag
- the smallest coherent remediation

Prefer remediation at the durable operating-system layer: schema, policy, interfaces, or playbooks before memory or ad hoc instructions.

## Constraints

- Audit the framework only; do not let this playbook expand into generic repository review.
- Follow the authority ladder for every conclusion.
- Do not weaken a higher-order artifact to accommodate lower-order drift.
- Treat memory and routing indices as supporting surfaces, not the primary source of policy.

## Notes for future variants

- This playbook should eventually gain a machine-readable process artifact under `spec/processes/`.
- If the framework later introduces additional governance capabilities, this playbook should stay focused on framework integrity rather than absorbing their full operating logic.
