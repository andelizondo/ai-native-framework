# P0 - Repository foundation

## Objective

Create a repository that is safe to collaborate in before product, growth, or operations workflows start shipping changes.

This is the first playbook step in the framework. It converts a raw repository into a governed execution surface with validation, review controls, security defaults, and contributor guidance.

## When to run

Run P0 immediately after creating a new repository and before opening normal feature branches.

## Outcomes

At the end of this playbook, the repository should have:

- A default branch pushed and treated as the protected source of truth.
- CI running on push and pull request.
- Branch protection bound to real required checks.
- Merge strategy and branch cleanup defaults configured.
- Repository rulesets configured for any default automated review behavior.
- Basic governance files for ownership, contribution flow, security reporting, issues, and pull requests.
- Dependency and security automation enabled.
- CODEOWNERS scoped to protected repository surfaces if low-risk PR automation will be allowed later.

## Inputs

- Repository name and owner.
- Default branch name (`main` unless policy requires otherwise).
- At least one passing validation workflow.
- Initial maintainer or owner handle for CODEOWNERS.

## Procedure

### 1. Publish the repository

1. Initialize git history if needed and push the default branch to GitHub.
2. Confirm the remote URL and authenticated GitHub identity are correct.
3. Ensure workflow publishing has the required token scopes before pushing `.github/workflows/*`.

## 2. Establish a minimum CI baseline

1. Add a workflow that runs on `push` and `pull_request`.
2. Make the workflow execute the repository's canonical validation command.
3. Prefer deterministic installs and caching where available.
4. Push the workflow and verify at least one successful run on the default branch.

For this repository, the required validation command is `npm run validate` and the required check context is `validate`.

## 3. Add repository governance files

Create the following files before broader collaboration begins:

- `.github/CODEOWNERS`
- `.github/pull_request_template.md`
- `.github/ISSUE_TEMPLATE/*`
- `.github/dependabot.yml`
- `CONTRIBUTING.md`
- `SECURITY.md`

These files establish who must review changes, how work enters the repo, and how vulnerabilities are handled.

If the repository will later allow low-risk automated PR approval or merge, CODEOWNERS **SHOULD** target protected surfaces instead of every file in the repository. A blanket `*` owner rule blocks low-risk automation by forcing owner review on every change.

## 4. Configure repository defaults on GitHub

Apply the following repository settings:

- Enable squash merge.
- Disable merge commits unless the repo has a specific reason to preserve them.
- Disable rebase merge unless the team explicitly prefers it.
- Enable delete branch on merge.
- Enable issues if they are part of the operating loop.
- Disable wiki unless it is intentionally used.
- Set the repository description.
- Configure repository rulesets for automated PR review if the repository will use a host-native reviewer such as GitHub Copilot.

These choices keep history readable and prevent the repo from accumulating unmanaged side channels.

If automated PR review is enabled at the repository level, the trigger configuration belongs in repository settings or rulesets, while repository-specific review behavior **SHOULD** remain in versioned files such as `.github/copilot-instructions.md`.

If P1 residual-risk decisions will depend on host-native reviewer output, that reviewer **SHOULD** be configured during P0 so automated review arrives before downstream agent policy or approval actions run.

If the repository is a personal repository with a single human operator, P0 **SHOULD** also decide which risk tiers permit an owner-decision path so P1 does not deadlock on a nonexistent second human reviewer.

## 5. Protect the default branch

Bind branch protection to the actual successful CI check emitted by GitHub Actions.

Recommended minimum protection:

- Require pull requests before merging.
- Require at least one approving review.
- Require CODEOWNERS review.
- Dismiss stale approvals on new commits.
- Require conversation resolution before merge.
- Enforce rules for administrators.
- Require linear history.
- Disallow force pushes.
- Disallow branch deletion.
- Require the canonical validation check.

Do not guess the required check name. Read it from the repository's check runs after the workflow has succeeded.

## 6. Enable security automation

Enable:

- Dependabot alerts
- Automated security fixes
- Secret scanning
- Push protection

Security automation should be on before contributors begin adding integrations, secrets, or deployment credentials.

## 7. Verify and record

1. Run the validation command locally.
2. Confirm the default branch is clean and tracking the remote.
3. Read back repository settings and branch protection from GitHub.
4. Record the applied configuration in the framework playbook so future repos reuse the same baseline.

## Baseline applied in this repository

The first execution of P0 in this repository applied the following concrete settings:

- Default branch: `main`
- Required check: `validate`
- Merge strategy: squash only
- Delete branch on merge: enabled
- Branch protection: enabled on `main`
- Reviews required: 1
- CODEOWNERS review: required
- CODEOWNERS scope: protected surfaces only
- Stale review dismissal: enabled
- Conversation resolution: required
- Linear history: required
- Force pushes: disabled
- Branch deletions: disabled
- Security automation: enabled
- Automated PR review: GitHub Copilot via repository ruleset on `~DEFAULT_BRANCH`
- Copilot review on new pushes: enabled
- Copilot review on draft PRs: disabled

## Notes for future variants

- Organizations may add team-based CODEOWNERS, signed-commit requirements, deployment environments, or release workflows on top of P0.
- Repositories that want low-risk auto-merge should keep CODEOWNERS focused on protected paths, not documentation-only surfaces.
- Repositories with multiple validation lanes may require more than one status check.
- If the framework later introduces machine-readable process schemas under `spec/processes/`, P0 should be encoded there as well as in Markdown.
