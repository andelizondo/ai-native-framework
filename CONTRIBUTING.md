# Contributing

## Development flow

1. Create a branch from `staging`.
2. Make schema, policy, example, and documentation changes together when behavior changes.
3. Run `npm run validate` before opening a pull request.
4. Open a pull request targeting `staging` with a concise summary and validation notes.

`staging` is the integration branch. It is protected with the same rules as `main`. The `staging` → `main` promotion is automated via release-please and requires no separate review when CI is green.

## Repository conventions

- Treat `spec/` as the canonical source for agent-facing behavior.
- Keep `docs/` aligned with normative changes.
- Prefer additive schema evolution and document breaking changes explicitly.
