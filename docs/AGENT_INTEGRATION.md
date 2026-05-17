# Agent Integration

How third-party agents (Claude Desktop, Cursor, custom MCP clients) integrate with framework products.

This doc explains the principle. The per-operation truth lives in [interfaces/interfaces.yaml](../interfaces/interfaces.yaml); the event envelope rules live in [spec/policy/event-taxonomy.yaml](../spec/policy/event-taxonomy.yaml). On conflict, those win.

## Principle

Every product capability MUST exist as an operation in `interfaces/interfaces.yaml`. The UI and any agent surface (MCP, future REST) are **adapters** that project a *curated* subset of those operations to their consumer. Coverage is a deliberate per-operation design decision, not automatic UI mirroring.

A capability that exists only in a UI component is a contract violation: the interface should describe it, and the UI should call it like any other adapter.

## Why MCP is not "every UI feature"

- LLM tool-selection accuracy degrades past roughly 30–50 tools. UI-only conveniences (drag-to-reorder, color pickers, hover affordances) pollute the agent's tool list without helping it.
- Some features are inherently visual. An agent doesn't want `render_board`; it wants `list_playbooks(workflow_id, stage)`.
- Destructive or irreversible operations need explicit human approval, per the authority ladder in [AGENTS.md](../AGENTS.md) and `policies.human_in_the_loop` in `interfaces.yaml`. An agent surface that exposes them blindly bypasses governance.

## Exposure categories

Each operation in `interfaces.yaml` declares an `agent_exposure` block with one of:

- `agent_safe` — read-only or idempotent mutation. Callable directly. Examples: `get_templates`, `list_instances`, `add_event` (idempotent via `correlation_id`).
- `confirm_required` — net-new resources, deletions, or other stake-bearing actions. Exposed via a two-call propose/confirm protocol (below). Maps to `policies.human_in_the_loop.required_for`.
- `ui_only` — visual / UX-only. Deliberately absent from agent tool lists. Examples: drag-to-reorder, color theme selection.

`agent_exposure.tool_name` is the agent-facing identifier and is required for non-`ui_only` operations. Tool names use `domain_verb_noun` shape (e.g., `workflows_create_instance`) — underscore separators only, to satisfy the MCP `^[a-zA-Z0-9_-]{1,64}$` name pattern that stricter clients enforce. Names are stable forever — deprecate and add a successor rather than rename, mirroring the event-naming rule.

## Confirmation protocol (`confirm_required`)

Two-call, agent-driven:

1. `propose_<op>(args)` → `{ proposal_token, human_diff, expires_at }`. No state change. Token is signed, scoped to user + operation + args hash, single-use, ~5 min TTL.
2. `confirm_<op>(proposal_token)` → executes.

This puts the human-in-the-loop checkpoint in the agent's own conversational surface (the agent shows the diff, the human approves there), rather than punting it to an out-of-band dashboard step.

## Auth and accountability

- Each integrator obtains a per-user credential (initial: Supabase PAT pasted into the MCP client config; future: OAuth device-code flow).
- Server resolves credential → `user_id`.
- Every emitted event sets `emitted_by` to the resolved principal (e.g., `mcp:<user_id>`), so MCP-driven changes are first-class citizens in the `workflow_events` stream — distinguishable from UI-driven changes only by principal, never by completeness.

## Drift prevention

Tool registrations for the MCP adapter are generated from the `agent_exposure` blocks in `interfaces.yaml`. There is no second source of truth. `npm run validate` fails if tool names collide or if a non-`ui_only` operation is missing a `tool_name`.

If you add a capability to the UI without an interface operation, the round-trip check fails in code review: the server action will not map to any operation, and the design-doc invariant is violated. Add the interface first.

## What this is not

- Not a REST API surface. REST is a separate adapter the design supports but does not require.
- Not a streaming/subscription protocol. Agents poll via `list_instances` or future `query_events`; MCP's subscription primitives are not stable enough to commit to.
- Not a way to bypass governance. `confirm_required` is operational mechanism for `policies.human_in_the_loop`, not an alternative to it.

## See also

- [interfaces/interfaces.yaml](../interfaces/interfaces.yaml) — per-operation `agent_exposure` blocks and the `adapters.mcp_server` entry.
- [spec/policy/event-taxonomy.yaml](../spec/policy/event-taxonomy.yaml) — event envelope and naming rules MCP mutations follow.
- [AGENTS.md](../AGENTS.md) — repository authority ladder and the `ai/` agent bundle (note: that bundle is for *coding* agents working on the repo, not end-user product agents using this surface).
