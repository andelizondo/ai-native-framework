# Contributing

## Development flow

1. Create a branch from `main`.
2. Make schema, policy, example, and documentation changes together when behavior changes.
3. Run `npm run validate` before opening a pull request.
4. Open a pull request with a concise summary and validation notes.

## Repository conventions

- Treat `spec/` as the canonical source for agent-facing behavior.
- Keep `docs/` aligned with normative changes.
- Prefer additive schema evolution and document breaking changes explicitly.
