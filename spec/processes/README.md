# spec/processes/

This directory holds machine-readable **process instances** — running or template instances of
workflows defined in the framework's Workflow Library (§7 of `docs/AI_NATIVE_FRAMEWORK.md`).

## What belongs here

Process instances follow the workflow record shape defined in §7.3 of the framework:

- Workflow name and category
- Trigger conditions
- Steps with owner, tooling, output, and checkpoint bindings
- Success criteria and exit conditions
- Human checkpoints declared per step
- Events emitted by the workflow

## What does NOT belong here

- Schema definitions → `spec/schema/`
- Product or slice specifications → `spec/examples/`
- Event taxonomy → `spec/policy/event-taxonomy.yaml`
- Narrative workflow descriptions → `docs/AI_NATIVE_FRAMEWORK.md`

## Status

Schemas for process instances are forthcoming. The directory and this README establish the
canonical location for process YAML files.

The first process instances to be encoded here are W1–W4 (opportunity research, product design,
build, launch) as referenced in `spec/examples/platform-product.yaml`. That encoding is a
separate, scoped task that requires its own session and briefing.

## Naming convention

Process instance files should be named `<workflow-id>.yaml`, for example:
- `w1-opportunity-research.yaml`
- `w2-product-design.yaml`
- `w3-build.yaml`
- `w4-launch.yaml`
