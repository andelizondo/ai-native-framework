# Analytics Standard

**Scope:** `products/dashboard` and all future products in this repository.  
**Authority:** Normative for any code that emits events or evaluates feature flags. See `spec/policy/event-taxonomy.yaml` for the canonical naming policy.

---

## 1. The rule: spec first, then type, then code

Before capturing a new event, follow this sequence without exception:

1. **Add to spec** — add the event entry to the relevant spec YAML under `spec/examples/` in the `events.catalog` block. Include the full classification block (pii, idempotency, ordering) and payload schema.
2. **Add to the type registry** — add the event to the `AnalyticsEvent` union in `lib/analytics/events.ts`. TypeScript will enforce name/property pairing at compile time everywhere the event is used.
3. **Add the capture call** — only after steps 1 and 2, add `capture()` or `captureServerEvent()` in the feature code.

This enforces the framework's event-catalog discipline at the process level. Shipping an event that is not in the spec is a spec violation.

---

## 2. Event naming

Pattern: `domain.action_past_tense` — from `spec/policy/event-taxonomy.yaml`.

| ✓ Valid | ✗ Invalid |
|---------|-----------|
| `user.signed_up` | `click` |
| `feature.viewed` | `button_pressed` |
| `spec.exported` | `page_load` |
| `dashboard.phase_navigated` | `UserSignedUp` |

- Domain is lowercase, singular noun representing the subject area.
- Action is a past-tense verb (or verb phrase), snake_case.
- No more than two segments. `auth.user.signed_up` is wrong; `user.signed_up` is right.

---

## 3. Which helper to use where

| Context | Import | Call |
|---------|--------|------|
| Client component | `import { useAnalytics } from '@/lib/analytics/events'` | `const { capture } = useAnalytics()` |
| Server component | `import { captureServerEvent } from '@/lib/analytics/server'` | `await captureServerEvent(userId, event, props)` |
| Route handler | `import { captureServerEvent } from '@/lib/analytics/server'` | `await captureServerEvent(userId, event, props)` |

**Never import `posthog-js` or `posthog-node` directly in feature files.**  
The only files that may import them are:
- `instrumentation-client.ts` (init only)
- `lib/analytics/posthog-server.ts` (server singleton)
- `lib/analytics/events.ts` (hook implementation)
- `lib/analytics/identity.ts` (identify/reset)
- `lib/analytics/flags.ts` (server-side flag evaluation)

---

## 4. PII rules (non-negotiable)

**Allowed in event properties:**
- `user_id` (UUID only — the Supabase auth UUID)
- Plan name (`free` | `pro`)
- Feature name (a string constant you defined, not user input)
- Action name (a string constant)
- Counts, booleans
- ISO date strings (e.g. `created_at: "2026-04-12"`) and schema-defined RFC3339 timestamps for sanctioned fields (e.g. `occurred_at` in event payloads) — arbitrary user-supplied datetime values and free-form timestamps remain forbidden

**Never allowed in event properties:**
- Email address
- Full name or display name
- IP address
- Any string typed or entered by the user
- Session token, cookie value, or any credential fragment

If a property would allow you to identify a specific person without their UUID, it does not belong in an event payload.

---

## 5. Identity rules

| Action | Function | File |
|--------|----------|------|
| User signs in | `identifyUser(userId, traits?)` | `lib/analytics/identity.ts` |
| User signs out | `resetIdentity()` | `lib/analytics/identity.ts` |

- Call `identifyUser()` exactly once per sign-in, passing the Supabase auth UUID as `userId`.
- Optional `traits`: only `plan` and `created_at` (ISO date string). Nothing else.
- Call `resetIdentity()` on sign-out so the next anonymous session is not linked to the previous user.
- **Never call `posthog.identify()` directly** in feature code. Use `identifyUser()`.
- `person_profiles: 'identified_only'` is set at init time — PostHog will not create a profile for anonymous users. Identity only exists after `identifyUser()` is called.

---

## 6. Feature flags

### Adding a flag

1. Document flag intent and rollout plan in the product spec `decision_log`.
2. Add the flag key to the `FeatureFlag` union in `lib/analytics/flags.ts`.
3. Create the flag in the PostHog dashboard (EU region) with matching key.

### Evaluating flags

**Server-side** (Server Components, Route Handlers):

```ts
import { getFlag } from '@/lib/analytics/flags'

const isEnabled = await getFlag('your-flag-key', userId)
```

**Client-side:** use `usePostHog()` from `posthog-js/react` inside a dedicated `useFlag` hook — never inline in feature components. Example:

```ts
// lib/analytics/useFlag.ts
'use client'
import { usePostHog } from 'posthog-js/react'
import type { FeatureFlag } from './flags'

export function useFlag(flag: FeatureFlag): boolean {
  const posthog = usePostHog()
  return posthog?.isFeatureEnabled(flag) ?? false
}
```

---

## 7. What not to instrument

Do not capture events for:

- Internal state changes with no user intent (e.g. a React re-render, a cache miss)
- Every keystroke or character of input
- Events that fire more than once per deliberate user action
- Any event where capturing it would require PII in a property
- Errors — use Sentry for that

The goal is behavioral signal, not a log stream.

---

## 8. Worked example: `spec.exported`

This example shows the complete path for a hypothetical event where a user exports a spec document.

### Step 1 — spec YAML entry (`spec/examples/dashboard-product.yaml`, `events.catalog`)

```yaml
- name: "spec.exported"
  description: "User exported a spec document to a file."
  version: "1.0.0"
  schema_version: "1.0.0"
  classification:
    pii: none
    idempotency: none
    ordering: at_least_once
  emitted_by:
    - "components.spec-editor"
  payload:
    type: object
    additionalProperties: false
    required:
      - format
    properties:
      format:
        type: string
        enum:
          - yaml
          - json
          - pdf
```

### Step 2 — `AnalyticsEvent` union entry (`lib/analytics/events.ts`)

```ts
| { event: 'spec.exported'; properties: { format: 'yaml' | 'json' | 'pdf' } }
```

### Step 3 — capture call in the export button component

```tsx
'use client'
import { useAnalytics } from '@/lib/analytics/events'

export function ExportButton({ format }: { format: 'yaml' | 'json' | 'pdf' }) {
  const { capture } = useAnalytics()

  return (
    <button
      onClick={() => {
        // ... export logic ...
        capture('spec.exported', { format })
      }}
    >
      Export
    </button>
  )
}
```

TypeScript enforces that `format` must be one of `'yaml' | 'json' | 'pdf'`. Any other value is a compile error. Any event name not in `AnalyticsEvent` is also a compile error.

### Step 4 — In the PostHog dashboard (EU region)

Navigate to **Insights → Events** and filter by `spec.exported`. The event will appear with property `format` populated. You can create a funnel or trend chart, or use it as a feature flag condition.

---

## 9. Error monitoring standard

### The rule: never import `@sentry/nextjs` in feature code

| Need | Import from | Call |
|------|-------------|------|
| Catch an error | `@/lib/monitoring` | `captureError(err, { feature: '...' })` |
| Log a warning or degraded state | `@/lib/monitoring` | `captureMessage('...', 'warning', { feature: '...' })` |
| Contain a client component | `@/lib/monitoring/boundary` | `<MonitoringBoundary feature="...">` |
| Performance span | `@/lib/monitoring` | `startSpan(...)` |

**Never** write `import * as Sentry from '@sentry/nextjs'` in feature code. The only files that may import `@sentry/nextjs` directly are:

- `sentry.server.config.ts`, `sentry.edge.config.ts` — Sentry SDK init
- `instrumentation-client.ts` — Sentry client init + Next.js router hooks (uses `Sentry.init()`, `replayIntegration()`)
- `next.config.ts` — build-time `withSentryConfig` wrapper
- `lib/monitoring/index.ts` and `lib/monitoring/boundary.tsx` — the abstraction layer itself

### When to use each

**`captureError(error, context)`** — caught exceptions, API failures, data integrity violations. Returns the Sentry event ID for cross-linking.

```ts
import { captureError } from "@/lib/monitoring"

try {
  await riskyOperation()
} catch (err) {
  captureError(err, { feature: "spec-editor", action: "save" })
}
```

**`captureMessage(message, level, context)`** — unexpected-but-handled states, fallback paths taken. Use `'warning'` by default. Use `'info'` sparingly (PostHog is the right tool for business events).

```ts
import { captureMessage } from "@/lib/monitoring"

if (response.status === 206) {
  captureMessage("Partial spec returned from API", "warning", { feature: "spec-loader" })
}
```

**`MonitoringBoundary`** — any client component that renders user data or makes external calls. The `feature` prop is required; it forces the call site to name the bounded region, making Sentry issue grouping useful.

```tsx
import { MonitoringBoundary } from "@/lib/monitoring/boundary"

<MonitoringBoundary feature="spec-editor" fallback={<ErrorState />}>
  <SpecEditor />
</MonitoringBoundary>
```

### Always include `feature` context

Every `captureError()` and `captureMessage()` call must include `feature`. This is the single most important field for triage: it tells you which part of the product broke without reading the stack trace.

### Identity sync

`identifyUser()` in `lib/analytics/identity.ts` calls both PostHog and `setMonitoringUser()` in a single call. `resetIdentity()` calls both PostHog reset and `clearMonitoringUser()`. You never need to call either Sentry or PostHog identity functions directly.

### Cross-linking with PostHog (for later)

`captureError()` returns the Sentry event ID as a string. When a logging layer is added, pass this as `sentry_event_id` to create a full trace: PostHog event → Sentry error → log entry.

### PII rules (same as PostHog)

- `userId` accepts Supabase UUID only
- `extra` must not contain email, name, or user-entered content
- `feature` and `action` must be string constants defined in code, not user input

---

## File map

| File | Purpose |
|------|---------|
| `instrumentation-client.ts` | PostHog init + Sentry init. Runs once on client load. SDK infrastructure — exempt from lib/monitoring constraint. |
| `lib/analytics/events.ts` | `AnalyticsEvent` type registry + `useAnalytics()` hook. |
| `lib/analytics/server.ts` | `captureServerEvent()` for server components and route handlers. |
| `lib/analytics/posthog-server.ts` | PostHog Node SDK singleton. Not imported outside `lib/analytics/`. |
| `lib/analytics/identity.ts` | `identifyUser()` and `resetIdentity()`. Syncs PostHog + Sentry identity. Called from auth flows only. |
| `lib/analytics/flags.ts` | `getFlag()` server-side flag evaluation + `FeatureFlag` type. |
| `lib/monitoring/index.ts` | Single import surface for all Sentry operations in feature code. |
| `lib/monitoring/boundary.tsx` | `MonitoringBoundary` — React error boundary with required feature tag. |
