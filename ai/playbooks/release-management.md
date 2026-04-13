# Release management

## Objective

Automate repository-level semantic version tags and GitHub Releases with a reviewable release PR, while keeping release governance aligned with the repository's pull-request policy.

## When to use

- enabling release automation for this repository
- changing versioning, changelog, release-tag, or GitHub Release behavior
- auditing why release PRs, tags, or Releases are not being created

## Inputs

- default release branch (`main` in this repository)
- canonical merge policy from `ai/playbooks/pull-request-execution-loop.md`
- release strategy (`release-please` + Conventional Commits for this repository)
- current release baseline and tag history
- GitHub Actions token configuration for release automation

## Outputs

- a release workflow under `.github/workflows/`
- repository release configuration (`release-please-config.json`, `.release-please-manifest.json`, optional `.github/release.yml`)
- documented operator setup requirements
- deterministic repo tags and GitHub Releases

## Constraints

- Treat the repository as the released unit; do not version `products/dashboard/` independently unless policy changes.
- Use a dedicated automation token for release creation when downstream PR or tag workflows must trigger. `GITHUB_TOKEN` does not trigger most follow-on workflows created by the workflow itself.
- Keep release tags SemVer-shaped and repo-level (`vX.Y.Z`).
- Release automation is control-plane work. Route changes through the normal PR loop and required checks.

## Procedure

1. Confirm the released unit is the whole repository, not a subpackage.
2. Keep Conventional Commits as the release signal:
   - `feat:` => minor
   - `fix:` => patch
   - `!` or `BREAKING CHANGE:` => major
3. Configure `release-please` in manifest mode for repo-root releases.
4. Seed `.release-please-manifest.json` with the current baseline version so the first automated release starts from an explicit point.
5. Add a release workflow on `main` and `workflow_dispatch`.
6. Require a dedicated `RELEASE_PLEASE_TOKEN` secret before automation runs:
   - this token should belong to a GitHub App or PAT that is allowed to open PRs and create tags
   - skipping on missing token is preferable to silently creating release PRs that bypass downstream checks
7. Keep changelog ownership with release automation:
   - `CHANGELOG.md` should be updated by the release PR
   - GitHub Release entries should be generated from the same release flow
8. If release notes need category grouping for manual GitHub Releases, maintain `.github/release.yml`.
9. Validate the repository after configuration changes with `npm run validate`.

## Failure modes

- No release PR appears after merge to `main`:
  - verify `RELEASE_PLEASE_TOKEN` is configured
  - verify the workflow ran on the current `main` SHA
  - verify merged commits follow Conventional Commits
- Release PR opens but required checks do not run:
  - confirm the workflow is using `RELEASE_PLEASE_TOKEN`, not `GITHUB_TOKEN`
- Tags or Releases are missing after a release PR merge:
  - inspect the `release-please` workflow on the merge commit
  - verify the manifest and config paths still match the workflow inputs

## Related artifacts

- `.github/workflows/release-please.yml`
- `release-please-config.json`
- `.release-please-manifest.json`
- `.github/release.yml`
- `ai/playbooks/pull-request-execution-loop.md`
