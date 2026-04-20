# Publish to production

## Objective

Publish the reviewed contents of `staging` to production by promoting `staging` into `main`, then verify that repository release automation continues from the new `main` head.

## When to use

- the operator asks to publish to production
- the operator asks how to open a PR to `main` in this repository
- `staging` has accumulated reviewed changes that should move to production
- you need to audit or repair the governed `staging` -> `main` promotion path

## Inputs

- current `staging` and `main` SHAs
- merge-gate state for the current `staging` head
- `.mergify.yml` queue rules
- release automation configuration from `ai/playbooks/release-management.md`
- any operator-provided release window, hold, or escalation note

## Outputs

- an open or updated promotion PR with `base=main` and `head=staging`
- merged production-publish PR state when policy allows it
- verification evidence that the merge used a regular merge commit, that `release-please` observed the new `main` head, and that the follow-on release PR auto-merged

## Constraints

- Do not open a feature branch PR directly against `main`. In this repository, the valid human-authored PR to `main` is the `staging` -> `main` promotion PR.
- Do not squash the promotion PR. The merge must preserve the conventional commits already reviewed on `staging`.
- Do not wait for CodeRabbit on the promotion PR. CodeRabbit auto-review is configured for feature PRs targeting `staging`, not for `staging` -> `main` promotion.
- Treat unexpected commits on `staging` as a stop condition. If the release scope is unclear, escalate before opening or merging the promotion PR.
- Production publication is a governed release action. Follow the pull-request execution loop for the PR itself, but use the promotion-specific checks and merge method documented here.

## Procedure

### 1. Confirm the operator wants a production publish

Translate "open a PR to `main`" into the repository's actual production path:

- source branch: `staging`
- target branch: `main`
- PR purpose: publish already reviewed integration work to production

If the requested change is still a feature or fix under development, stop and route it back to a normal PR targeting `staging`.

### 2. Verify the release scope on `staging`

Before opening or reusing the promotion PR:

1. Compare `main..staging` and confirm the commits are the intended release scope.
2. Check whether any in-flight PRs still target `staging` and have not merged yet.
3. Refresh the local `staging` branch from `origin/staging` before opening the PR so the published head is current.
4. Confirm the current `staging` head has passed the required integration gates for this repository.

If the diff contains work the operator does not intend to publish, stop and ask for a release-scope decision instead of opening the PR.

### 3. Open or refresh the promotion PR

Create a ready-for-review PR with:

- `base=main`
- `head=staging`
- non-draft state
- summary focused on the production publish scope and notable operational risk
- a `BEGIN_COMMIT_OVERRIDE` / `END_COMMIT_OVERRIDE` block in the PR body with standardized conventional-commit lines for every releasable change in this promotion scope

This PR is not a feature review surface. The substantive review already happened on the feature PRs that landed in `staging`.

**Required release-please override block (mandatory):**

Before merging any `staging` -> `main` promotion PR, include this section in the PR body:

```md
BEGIN_COMMIT_OVERRIDE
<one standardized conventional commit per releasable item>
END_COMMIT_OVERRIDE
```

Standardization rules:

- Use one line per releasable change.
- Use only conventional commit prefixes: `feat`, `fix`, `perf`, `revert`, and optionally `chore` when release metadata is intentionally desired.
- Keep each line in the form: `<type>(<scope>): <short summary>`.
- Keep summaries concise and user-facing; avoid tooling noise, PR numbers, merge boilerplate, and co-author trailers.
- Do not include `docs`, `test`, `ci`, or other non-releasable-only entries unless you intentionally want them reflected in release notes.

Example:

```md
BEGIN_COMMIT_OVERRIDE
feat(dashboard): workflow run controls and task retry/cancel UX
fix(policy): require trusted bot identity for reviewer-skip paths
END_COMMIT_OVERRIDE
```

Canonical CLI sequence:

```bash
git fetch origin
git checkout staging
git pull --ff-only origin staging

gh pr create \
  --base main \
  --head staging \
  --title "Promote staging to main" \
  --body "## Summary

- Publish the current reviewed staging branch to production

## Validation

- [ ] \`npm run validate\`
- [ ] \`test\` green on the current staging head

## Notes

- This is the governed production-publish PR for the current staging head.
- Follow-on release automation should open a separate \`release-please\` PR after merge."
```

If a promotion PR already exists, do not open a duplicate. Reuse the existing PR and continue from its current state.

### 4. Apply the promotion gate

For the `staging` -> `main` PR, the canonical merge gate is the `staging-promotion` Mergify queue in `.mergify.yml`.

Required conditions in this repository:

- `validate` succeeds
- `test` succeeds
- `decide` succeeds
- `residual:low` is present
- PR is not draft
- `sync:needed` is absent

CodeRabbit and `e2e` are not part of this promotion gate in the current repository configuration.

### 5. Merge through the queue with a regular merge commit

When the conditions above are met:

1. Queue the PR on `staging-promotion` if it is not already queued.
2. Let Mergify merge it with `merge_method: merge`.
3. If the queue drops the PR after conditions were previously satisfied, repair the cause, then re-queue with `@mergifyio queue staging-promotion`.

Do not use squash or rebase merge for this path unless repository policy changes.

### 6. Verify post-merge release automation

After the PR merges:

1. Confirm `main` advanced to the merged `staging` head via a merge commit.
2. Confirm `.github/workflows/release-please.yml` ran on the new `main` SHA.
3. Confirm release automation opened or updated the second PR on `main` with title pattern `chore: release X.Y.Z` when releasable conventional commits are present.
4. Confirm the second PR receives `residual:low`, passes `validate` and `decide`, and auto-merges through the `release-please` Mergify queue in `.mergify.yml`.
5. Confirm the merge of the second PR created the tag and GitHub Release expected by `release-please`.
6. If no release PR appears, or it opens but does not auto-merge, inspect the failure modes in `ai/playbooks/release-management.md` before treating production publication as complete.
7. If release-please logs report `commit could not be parsed` on the promotion merge commit, update the merged promotion PR body with a corrected `BEGIN_COMMIT_OVERRIDE` block and rerun the release-please workflow.

Canonical verification sequence:

```bash
gh pr list --base main --head staging --state all
gh run list --workflow release-please --branch main --limit 5
gh pr list --base main --search "head:release-please" --state all
```

For the follow-on release PR, check these expectations:

- branch name starts with `release-please`
- title matches `chore: release X.Y.Z`
- `validate` passes
- `decide` passes
- `residual:low` is present
- Mergify merges it automatically via the `release-please` queue

The second PR should not require manual publication work in the ordinary happy path.

### 7. Record the publish evidence

Capture the minimum audit bundle:

- promotion PR URL
- merge commit SHA on `main`
- `staging` head SHA that was promoted
- release-please workflow run URL
- follow-on release PR URL and merge SHA
- back-merge PR URL (from §8) and merge SHA
- any operator-visible note about holds, exceptions, or intentionally deferred release follow-up

### 8. Back-merge `main` into `staging`

After release-please publishes the `vX.Y.Z` tag, `main` is two commits ahead of `staging`:

1. The promotion merge commit produced by §5.
2. `chore: release X.Y.Z` produced by release-please.

Those commits **MUST** be back-merged into `staging` before the next feature PR or the next promotion. The back-merge **MUST** use a regular merge commit so `main` remains an ancestor of `staging` — a squash merge drops the second parent and leaves `staging` content-equal but history-divergent, which forces the next promotion PR open in a `BEHIND` state with `sync:needed`.

**Canonical path: automated.**

`.github/workflows/back-merge-to-staging.yml` runs on `release: published`. It:

1. Branches `chore/back-merge-main-after-vX.Y.Z` from the current `staging` head.
2. Performs `git merge --no-ff origin/main`.
3. Opens a PR (`base=staging`, `head=chore/back-merge-main-after-vX.Y.Z`) with the `residual:low` label so policy auto-clears it.
4. Merges the PR with `gh pr merge --merge --admin`, bypassing required status checks because every commit being merged has already been reviewed and shipped through its own PR.

The `--admin` step requires `RELEASE_PLEASE_TOKEN` (the same maintainer PAT used by `release-please.yml`). If the token is unset the workflow opens the PR but cannot merge it; a maintainer must finish with `gh pr merge <n> --merge --admin --delete-branch`.

**Mergify safety net.**

If the workflow's admin merge step fails or is skipped, `.mergify.yml` defines a `back-merge-to-staging` queue that picks up any open PR whose `head` matches `^chore/back-merge-main-after-` and merges it with `merge_method: merge` once required branch-protection checks settle. The `staging-integration` (squash) queue explicitly excludes that branch pattern so the back-merge cannot accidentally land as a squash.

**Manual fallback.**

If both the workflow and the queue are unavailable (token missing, workflow disabled, branch protection mid-change, or this is the bootstrap run before the workflow exists on `main`), do the back-merge by hand. **Open the PR as a draft** so the `staging-integration` queue cannot race in and squash it before all checks settle and you `--admin` merge:

```bash
git fetch origin
git checkout staging
git pull --ff-only origin staging
git checkout -b chore/back-merge-main-after-<tag>
git merge --no-ff origin/main \
  -m "chore: back-merge main into staging after release <tag>"
git push -u origin HEAD

# Draft prevents Mergify from queueing this PR while checks run.
gh pr create --draft \
  --base staging \
  --head "chore/back-merge-main-after-<tag>" \
  --title "chore: back-merge main into staging after release <tag>" \
  --body "Manual back-merge per ai/playbooks/publish-to-production.md §8." \
  --label "residual:low"

# Wait for validate / test / e2e / decide to be green on the PR head.
# Then mark ready and admin-merge in one motion.
gh pr ready <pr-number>
# IMPORTANT: must be --merge (not --squash) so main stays an ancestor of staging.
gh pr merge <pr-number> --merge --admin --delete-branch
```

Why draft: the `back-merge-to-staging` queue accepts the PR without checks, but Mergify's queue selection between two matching queues is not deterministic across versions. If `staging-integration` ever admits the back-merge branch (a Mergify-config bug, a change in matching semantics, or a typo in the negation guard), the PR is squashed and ancestry is silently broken. Drafting locks Mergify out until you take it ready and merge in the same step.

**Verification.**

After the back-merge merges, confirm:

- `git log origin/staging..origin/main` is empty (nothing left on `main` that is not on `staging`).
- `gh api repos/<owner>/<repo>/compare/main...staging --jq '.behind_by'` returns `0`.
- The merge commit on `staging` has two parents (`git show --no-patch --format='%h %p' origin/staging`).

If `behind_by` is still non-zero, the back-merge probably squashed instead of merged. Repair by opening a zero-diff merge-commit PR (a fresh `git merge --no-ff origin/main` against the current `staging` head) and admin-merge it with the merge method.

## Expected three-PR sequence

When this repository publishes normally, the sequence is:

1. Open and merge the human-authored promotion PR: `staging` -> `main`.
2. `release-please` runs on the new `main` head.
3. `release-please` opens or updates a second PR from a `release-please*` branch with title `chore: release X.Y.Z`.
4. The policy workflow can set `residual:low` on that release PR without CodeRabbit, because it is automation-shaped release metadata work.
5. Mergify auto-queues and auto-merges the second PR through the `release-please` queue when `validate` and `decide` succeed.
6. The merge of the second PR creates the tag and GitHub Release.
7. The `release: published` event fires `back-merge-to-staging.yml`, which opens and admin-merges a third PR (`chore/back-merge-main-after-vX.Y.Z` -> `staging`) so `main` is an ancestor of `staging` again before the next feature lands.

The first PR is human-decided. The second and third are repository-managed automation; they should not require manual review work in the ordinary happy path.

## Related artifacts

- `ai/playbooks/pull-request-execution-loop.md`
- `ai/playbooks/release-management.md`
- `ai/playbooks/environment-separation.md`
- `.mergify.yml`
- `.github/workflows/release-please.yml`
- `.github/workflows/back-merge-to-staging.yml`
