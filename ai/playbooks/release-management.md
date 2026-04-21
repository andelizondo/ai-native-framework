# Release management

## Use When

- enabling or changing repo-level release automation
- auditing missing release PRs, tags, or GitHub Releases
- changing versioning, changelog, or release-token behavior

## Inputs

- default release branch
- release strategy
- current version baseline and tag history
- token configuration
- merge policy

## Outputs

- release workflow
- release configuration
- canonical repo release source
- documented operator setup

## Steps

1. Treat the repository, not a subpackage, as the released unit unless policy changes.
2. Keep Conventional Commits as the release signal.
3. Configure `release-please` in manifest mode.
4. Keep root `version.txt` as the canonical runtime release value.
5. Require `RELEASE_PLEASE_TOKEN` when downstream workflows must trigger.
6. Keep changelog and GitHub Releases driven by the same release flow.
7. For runtime consumers, derive production release from the repo tag and allow non-production SHA fallback.
8. If Sentry release sync exists, publish the same release identifier the app emits.
9. Validate the repo after release-config changes.

## Constraints

- release tags stay repo-level and SemVer-shaped
- control-plane changes still go through the normal PR loop
- `GITHUB_TOKEN` is insufficient when follow-on workflows must trigger

## References

- `version.txt`
- `.github/workflows/release-please.yml`
- `release-please-config.json`
- `.release-please-manifest.json`
- `ai/playbooks/publish-to-production.md`
