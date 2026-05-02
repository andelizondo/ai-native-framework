# Publish to production

## Use When

- the operator asks to publish to production
- the operator asks how PRs to `main` work here
- reviewed `staging` work should move to production

## Inputs

- current `staging` and `main` SHAs
- promotion PR state
- queue state
- release automation state

## Outputs

- open or merged `staging` -> `main` promotion PR
- release-automation verification
- publish evidence bundle

## Steps

1. Confirm the operator wants a production publish, not a feature PR.
2. Verify the release scope on `staging`; stop if unexpected commits are present.
3. Open or refresh the ready-for-review promotion PR with `base=main`, `head=staging`, and the required release-please override block.
4. Apply the promotion gate from `.mergify.yml`.
5. Merge through the promotion queue using a regular merge commit.
6. Verify that `release-please` observed the new `main` head, opened or updated the release PR, and completed the follow-on release flow.
7. Record the publish evidence bundle.
8. Back-merge `main` into `staging` with a regular merge commit so ancestry stays intact.

## Canonical Snippet

### Release-please override block

Use this exact block in the promotion PR body:

```md
BEGIN_COMMIT_OVERRIDE
<one standardized conventional commit per releasable item>
END_COMMIT_OVERRIDE
```

Rules:

- one line per releasable change
- use conventional commit prefixes such as `feat`, `fix`, `perf`, `revert`, or intentionally `chore`
- keep each line in the form `<type>(<scope>): <short summary>`
- keep summaries concise and user-facing
- omit non-releasable-only entries unless they are intentionally part of release metadata

## Constraints

- no feature PRs directly to `main`
- do not squash the promotion or back-merge PRs
- do not trigger Qodo Code Review on the promotion PR
- stop if the release scope on `staging` is unclear

## References

- `ai/playbooks/release-management.md`
- `ai/playbooks/pull-request-execution-loop.md`
- `.mergify.yml`
