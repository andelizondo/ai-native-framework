# Feature Implementation Playbook

**Version:** 1.0  
**Product:** `products/dashboard`  
**Authority:** Subordinate to `spec/schema/`, `spec/policy/`, and `docs/ANALYTICS_STANDARD.md`. Extends `ai/skills/developer.md` for dashboard product work.

---

## Objective

Implement a dashboard feature from a completed feature request (`templates/feature-request.md`) with observability, type safety, and spec compliance as default parts of the deliverable — not follow-up items.

---

## Inputs

- Completed `templates/feature-request.md` for the feature
- Current state of `spec/examples/dashboard-product.yaml`
- Current state of `products/dashboard/lib/analytics/events.ts`
- Current state of the relevant components under `products/dashboard/`

## Outputs

- Updated `spec/examples/dashboard-product.yaml` (events + metrics)
- Updated `products/dashboard/lib/analytics/events.ts` (new event type entries)
- Feature component(s) under `products/dashboard/`
- PostHog capture calls in every user-action path
- `npm run validate` passing
- PR ready for review per `ai/playbooks/pull-request-execution-loop.md`

---

## Workflow

### Step 1 — Read before touching anything

1. Read the feature request in full.
2. Read `spec/examples/dashboard-product.yaml` — understand existing events and which slice this feature belongs to.
3. Read `products/dashboard/lib/analytics/events.ts` — understand existing event types so you do not duplicate or conflict.
4. Read the component(s) the feature will touch or extend. The reference implementation for the full dual-pipeline pattern is `components/shell-events.tsx` and `components/sidebar.tsx`.

Do not edit any file until these four reads are complete.

### Step 2 — Spec first: update the event catalog

Before writing any component code, add the new event(s) to `spec/examples/dashboard-product.yaml` under `events.catalog`.

Each catalog entry requires:

```yaml
- name: "domain.action_past_tense"        # must match spec/policy/event-taxonomy.yaml
  description: "..."
  version: "1.0.0"
  schema_version: "1.0.0"
  classification:
    pii: none                              # none | low | high — be honest
    idempotency: none                      # none | recommended | required
    ordering: at_least_once
  emitted_by:
    - "components.your-component"         # matches the component file/folder name
  payload:
    type: object
    additionalProperties: false
    required:
      - key_property
    properties:
      key_property:
        type: string
```

Also add or update `observability.metrics.core_metrics` if the feature introduces a trackable signal worth monitoring long-term.

Run `npm run validate` after this step. **Do not continue if validation fails.**

### Step 3 — Type registry: add to AnalyticsEvent

Add the new event(s) to the `AnalyticsEvent` union in `products/dashboard/lib/analytics/events.ts`:

```ts
// ── [Feature domain] ──────────────────────────────────────────────────────
| { event: 'domain.action_past_tense'; properties: { key_property: string } }
```

Rules:
- Event name must exactly match the catalog entry added in Step 2.
- Properties must never include email, name, or any user-entered string.
- Group new entries under a named comment block (see existing grouping in the file).

### Step 4 — Implement the component

Write the UI component(s). Keep this step strictly UI — no analytics capture calls yet.

Component conventions in this codebase:
- Client components: `"use client"` at top, file in `components/`
- Server components: no directive, file in `components/` or colocated in `app/`
- Route handlers: `app/api/<resource>/route.ts`
- Styles: Tailwind utility classes; use `cn()` from `@/lib/utils` for conditional classes
- UI primitives: `components/ui/` (shadcn/ui) — do not re-implement what's already there

### Step 5 — Wire the dual pipeline

Every user-facing action that was declared in the feature request's events table must call **both** pipelines:

```ts
// 1. Internal audit pipeline — correlation_id tagged, logged to stdout via /api/events
emitEvent("domain.action_past_tense", { key_property: value });

// 2. PostHog — typed, goes to EU region via /ingest proxy
capture("domain.action_past_tense", { key_property: value });
```

The `capture` function comes from `useAnalytics()` imported from `@/lib/analytics/events`:

```ts
import { useAnalytics } from "@/lib/analytics/events";

// inside your component:
const { capture } = useAnalytics();
```

The `emitEvent` function comes from `@/lib/events` (unchanged).

**Do not call `posthog.capture()` directly. Do not import `posthog-js` in feature files.**

For page-level views (equivalent to `ShellEvents`), fire on `useEffect` with the route or feature name as dependency:

```ts
useEffect(() => {
  emitEvent("feature.viewed", { feature_name: "your-feature" });
  capture("feature.viewed", { feature_name: "your-feature" });
}, [capture]);
```

For action events (equivalent to `Sidebar.handlePhaseClick`), fire inline on the handler:

```ts
function handleAction() {
  // ... business logic ...
  emitEvent("domain.action_past_tense", { key_property: value });
  capture("domain.action_past_tense", { key_property: value });
}
```

### Step 6 — Error monitoring coverage

**Never import `@sentry/nextjs` in feature code.** All error monitoring goes through `lib/monitoring`.

Every route handler must be wrapped in `startSpan`:

```ts
import { captureError, startSpan, setMonitoringTag } from "@/lib/monitoring"

return await startSpan({ name: "POST /api/my-route", op: "http.server", attributes: { "app.product_id": PRODUCT_ID } }, async () => {
  // handler body
})
```

Every catch block that could silently fail in production must call `captureError`:

```ts
} catch (err) {
  captureError(err, { feature: "my-feature", extra: { correlation_id: correlationId } })
}
```

Client components that render user data or make external calls should be wrapped in `MonitoringBoundary`:

```tsx
import { MonitoringBoundary } from "@/lib/monitoring/boundary"

<MonitoringBoundary feature="my-feature" fallback={<ErrorState />}>
  <MyComponent />
</MonitoringBoundary>
```

Reference: `app/api/events/route.ts` is the canonical route handler example. `app/api/sentry-test/route.ts` shows `captureError` + `flush` for deliberate test captures.

### Step 7 — Validate and verify

```bash
cd /path/to/repo && npm run validate
```

Must pass. If it fails, fix the YAML before continuing.

Also verify manually:
- No `import posthog` outside `lib/analytics/`
- No `import { PostHog }` outside `lib/analytics/`
- Every event fired in the component matches an entry in `AnalyticsEvent`
- The spec YAML entry was added to `spec/examples/dashboard-product.yaml`, not only to `golden-product.yaml`

### Step 8 — PR

Follow `ai/playbooks/pull-request-execution-loop.md`.

PR description must include:
- Which feature request this implements (link or name)
- The new event(s) added to the type registry
- Confirmation that `npm run validate` passes

---

## Decision Rules

- If the feature request's events table is blank, stop and ask. Events are required, not optional.
- If a property the feature naturally produces would require PII (email, name, user input), use `user_id` (UUID) instead and note the substitution in the PR.
- If the feature needs a new API route, it needs its own internal event and Sentry span — do not skip either.
- If a new event concept would apply to multiple future features, prefer a generic form (`feature.viewed`, `feature.action_taken`) with a discriminating property over a narrow, one-off name.
- If a feature has no user-facing action that warrants a PostHog event, document why in the spec under `observability` and leave a comment in the component. This is a legitimate decision, not a skip.
- Never import `@sentry/nextjs` or `posthog-js` directly in feature code. Both have abstraction layers — use them.

---

## Reference Implementation

The complete dual-pipeline pattern as shipped in the dashboard shell:

| Concern | File | What it shows |
|---------|------|---------------|
| Event type registry | `lib/analytics/events.ts` | How to add a new event to `AnalyticsEvent` |
| Page view tracking | `components/shell-events.tsx` | `useEffect` + dual pipeline for page-level events |
| Action tracking | `components/sidebar.tsx` | Inline handler + dual pipeline for user actions |
| Route handler instrumentation | `app/api/events/route.ts` | `startSpan` + `captureError` + `setMonitoringTag` |
| Deliberate error capture | `app/api/sentry-test/route.ts` | `captureError` + `flush` pattern |
| Server-side analytics capture | `lib/analytics/server.ts` | `captureServerEvent` for route handlers and server components |
| Error abstraction layer | `lib/monitoring/index.ts` | All exports available to feature code |
| React error boundary | `lib/monitoring/boundary.tsx` | `MonitoringBoundary` usage |

---

## Canonical References

- `AGENTS.md`
- `ai/skills/developer.md`
- `ai/playbooks/pull-request-execution-loop.md`
- `docs/ANALYTICS_STANDARD.md` (§§ 1–8 for PostHog; § 9 for error monitoring)
- `spec/policy/event-taxonomy.yaml`
- `spec/examples/dashboard-product.yaml`
- `templates/feature-request.md`
