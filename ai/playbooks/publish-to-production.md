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
3. Confirm the current `staging` head has passed the required integration gates for this repository.

If the diff contains work the operator does not intend to publish, stop and ask for a release-scope decision instead of opening the PR.

### 3. Open or refresh the promotion PR

Create a ready-for-review PR with:

- `base=main`
- `head=staging`
- non-draft state
- summary focused on the production publish scope and notable operational risk

This PR is not a feature review surface. The substantive review already happened on the feature PRs that landed in `staging`.

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
- any operator-visible note about holds, exceptions, or intentionally deferred release follow-up

## Expected two-PR sequence

When this repository publishes normally, the sequence is:

1. Open and merge the human-authored promotion PR: `staging` -> `main`.
2. `release-please` runs on the new `main` head.
3. `release-please` opens or updates a second PR from a `release-please*` branch with title `chore: release X.Y.Z`.
4. The policy workflow can set `residual:low` on that release PR without CodeRabbit, because it is automation-shaped release metadata work.
5. Mergify auto-queues and auto-merges the second PR through the `release-please` queue when `validate` and `decide` succeed.
6. The merge of the second PR creates the tag and GitHub Release.

## Related artifacts

- `ai/playbooks/pull-request-execution-loop.md`
- `ai/playbooks/release-management.md`
- `ai/playbooks/environment-separation.md`
- `.mergify.yml`
- `.github/workflows/release-please.yml`
