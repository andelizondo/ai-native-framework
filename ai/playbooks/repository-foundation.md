# Repository foundation

## Use When

- creating a new governed repository
- auditing or repairing governance, CI, protection, or contributor surfaces

## Inputs

- repo owner and name
- default branch
- at least one passing validation workflow
- maintainer handle for ownership surfaces

## Outputs

- governed repo baseline
- required governance files
- branch protection bound to real checks
- security automation enabled

## Steps

1. Publish the repository and confirm the remote and identity are correct.
2. Add a minimum CI workflow that runs the canonical validation command and confirm a passing check on the default branch.
3. Add governance files: `CODEOWNERS`, PR template, issue templates, `CONTRIBUTING.md`, `SECURITY.md`, `dependabot.yml`.
4. Configure repo defaults: merge strategy, branch cleanup, issues, description, and automated reviewer setup if used.
5. Protect the default branch with real required checks, stale-review handling, conversation resolution, linear history, and admin enforcement.
6. Enable security automation: alerts, automated fixes, secret scanning, push protection.
7. Verify the configuration from GitHub and record the durable baseline.
8. If the repo uses the 3-tier model, establish protected `staging`, redirect feature PRs there, scope observability by environment, and wire release/promotion behavior.

## Constraints

- never guess required check names
- CODEOWNERS should protect sensitive surfaces without blocking low-risk automation everywhere
- control-plane behavior must be observable on real PRs, not assumed from settings alone

## References

- `AGENTS.md`
- `ai/playbooks/environment-separation.md`
- `ai/playbooks/pull-request-execution-loop.md`
