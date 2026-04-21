# Feature implementation

## Use When

- implementing a new feature in `products/dashboard/` from a completed feature request

## Inputs

- completed `templates/feature-request.md`
- current `spec/examples/dashboard-product.yaml`
- current `products/dashboard/lib/analytics/events.ts`
- relevant product components and, for auth changes, `products/dashboard/lib/auth/`

## Outputs

- updated spec catalog and metrics
- updated analytics event registry
- feature implementation
- required analytics and monitoring wiring
- passing `npm run validate`

## Steps

1. Read the feature request, spec, analytics registry, and affected implementation before editing.
2. Update the spec first: add events to `events.catalog`, update metrics when needed, and validate before continuing.
3. Add matching event types to `products/dashboard/lib/analytics/events.ts`.
4. Implement the UI or route behavior.
5. Wire the declared analytics events through the approved abstractions, not direct vendor imports.
6. Add required monitoring coverage through `lib/monitoring`, not direct Sentry imports.
7. Verify event names, payloads, abstraction boundaries, and `npm run validate`.
8. Publish through the normal PR loop.

## Constraints

- events are required, not optional
- spec and event registry update before feature code
- auth provider details stay inside `lib/auth/`
- do not import `posthog-js` or `@sentry/nextjs` directly in feature code

## References

- `docs/ANALYTICS_STANDARD.md`
- `spec/policy/event-taxonomy.yaml`
- `ai/playbooks/pull-request-execution-loop.md`
