# Environment separation

## Use When

- establishing the 3-tier production/staging/development model
- auditing or repairing polluted production analytics or error dashboards
- adding an observability or data service that needs environment scoping

## Inputs

- repo owner and name
- production and staging domains
- Vercel project access
- GitHub admin access
- GitHub token for API work

## Outputs

- protected `staging` branch
- feature PRs targeting `staging`
- nightly CI targeting staging
- observability env vars scoped by environment
- data tier separated by environment

## Steps

1. Create a long-lived `staging` branch from `main`.
2. Mirror `main` branch protection onto `staging`.
3. Create or update the `STAGING_URL` repository variable.
4. Point nightly and other non-production automation at staging, never production.
5. Assign a stable Vercel alias to `staging`.
6. Scope analytics tokens to Production only and keep Sentry active on Preview/staging.
7. Configure merge queues and docs so feature PRs target `staging` and production publishes use `staging` -> `main`.
8. Separate the data tier as well: one hosted database project per environment, env-scoped secrets, and migration gates per branch.
9. Verify branch protection, staging routing, env scoping, migration behavior, and validation before closing.

## Constraints

- never target production from nightly CI
- do not create a separate PostHog project for staging; scope the token instead
- one hosted database project per environment is mandatory
- promotion from `staging` to `main` uses regular merge, not squash

## References

- `ai/playbooks/repository-foundation.md`
- `ai/playbooks/publish-to-production.md`
- `ai/playbooks/service-wiring.md`
