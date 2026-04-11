# Repository foundation

## Objective

Create a repository that is safe to collaborate in before product, growth, or operations workflows start shipping changes.

This playbook converts a raw repository into a governed execution surface with validation, review controls, security defaults, and contributor guidance.

## When to run

Run it when you create a new repository and before opening normal feature branches, or whenever you need to audit or repair the same surfaces in an existing repository.

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
- Configure automated PR review for the repository if pull request automation will depend on a repository-configured AI reviewer.

These choices keep history readable and prevent the repo from accumulating unmanaged side channels.

If automated PR review is enabled at the repository level, the trigger configuration belongs in repository settings, rulesets, or app configuration, while repository-specific review behavior **SHOULD** remain in versioned configuration files such as `.coderabbit.yaml` or equivalent reviewer config.

If residual-risk decisions in the pull request execution playbook will depend on host-native reviewer output, that reviewer **SHOULD** be configured while applying this playbook so automated review arrives before downstream agent policy or approval actions run. This playbook **SHOULD** also verify that the expected review artifact is observable on PRs for the current head SHA, because repository configuration alone is not sufficient evidence that review actually ran.

If the repository is a personal repository with a single human operator, this playbook **SHOULD** also decide which risk tiers permit an owner-decision path so pull request policy does not deadlock on a nonexistent second human reviewer.

## 5. Protect the default branch

Bind branch protection to the actual successful CI check emitted by GitHub Actions.

Recommended minimum protection:

- Require pull requests before merging.
- Require the repository's real merge-gate checks on the protected branch.
- Dismiss stale approvals on new commits.
- Require conversation resolution before merge.
- Enforce rules for administrators.
- Require linear history.
- Disallow force pushes.
- Disallow branch deletion.
- Require strict status checks so the PR branch must be up to date before merge.

Do not guess the required check name. Read it from the repository's check runs after the workflow has succeeded.
If repository policy intentionally delegates merge authority to a policy check instead of GitHub's built-in approval count, branch protection **MUST** still require every concrete merge gate status context that agents depend on. Missing branch protection is a control-plane incident and should be corrected immediately.

Repositories that shift merge authority from GitHub's built-in required-review gate to a repository-specific policy check **SHOULD** document that explicitly. In that mode, GitHub branch protection may require zero built-in approvals while still requiring a policy check such as `decide` before merge.

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

The current repository-foundation baseline in this repository applies the following concrete settings:

- Default branch: `main`
- Required checks: `validate`, `decide`, `CodeRabbit`
- Merge strategy: squash only
- Delete branch on merge: enabled
- Branch protection: enabled on `main`
- Strict status checks: enabled
- Built-in GitHub approvals required: 0
- Merge authority delegated to policy check: yes (`decide`)
- CODEOWNERS review required by branch protection: no
- CODEOWNERS scope: protected surfaces only
- Stale review dismissal: enabled
- Conversation resolution: required
- Linear history: required
- Force pushes: disabled
- Branch deletions: disabled
- Security automation: enabled
- Automated PR review: CodeRabbit via `.coderabbit.yaml`
- CodeRabbit review on new pushes: enabled
- CodeRabbit review on draft PRs: disabled
- Policy gate for observed CodeRabbit review artifact on the current head SHA before residual-low merge authority: enabled

## Notes for future variants

- Organizations may add team-based CODEOWNERS, signed-commit requirements, deployment environments, or release workflows on top of this baseline.
- Repositories that want low-risk auto-merge should keep CODEOWNERS focused on protected paths, not documentation-only surfaces.
- Repositories with multiple validation lanes may require more than one status check.
- If the framework later introduces machine-readable process schemas under `spec/processes/`, this playbook should be encoded there as well as in Markdown.
