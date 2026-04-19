# Environment separation

## Objective

Establish a clean 3-tier deployment environment model (production / staging / development) so that automated test traffic never reaches production analytics or error-rate baselines, and production metrics reflect real users only.

## When to run

- Standing up the environment model for a new repository or product for the first time
- Auditing or repairing an existing environment setup where test traffic is polluting production metrics
- Adding a new observability tool that needs to be scoped by environment

## Outcomes

At the end of this playbook:

- A long-lived `staging` branch exists with identical protection rules to `main`
- Feature PRs target `staging`; `staging` → `main` is the automated release gate
- Nightly CI targets the stable staging URL, never production
- PostHog (and equivalent analytics tokens) initializes only in the Production Vercel environment
- Sentry remains active on staging for real integration error visibility
- Production metrics and error dashboards reflect real users exclusively

## Inputs

- Repository name and owner
- Production domain (e.g. `ai-native-framework.app`)
- Staging domain to assign (e.g. `staging.ai-native-framework.app`)
- Vercel project access
- GitHub admin access (for branch protection)
- GitHub token with `repo` and `actions` scopes (for API calls)

## Tooling coverage map

| Action | Tool available | Where to do it |
|---|---|---|
| Create `staging` branch | GitHub MCP (`create_branch`) or `git push` | Automated |
| Set branch protection rules | GitHub REST API (`PUT /branches/{branch}/protection`) | Automated with token |
| Create `STAGING_URL` repository variable | GitHub REST API (`POST /actions/variables`) | Automated with token |
| Assign stable Vercel domain alias to `staging` branch | **None** | Vercel dashboard → Settings → Domains |
| Scope Vercel env vars to Production only | **None** | Vercel dashboard → Settings → Environment Variables |

## Procedure

### 1. Create the staging branch

```bash
git checkout main && git pull
git checkout -b staging
git push -u origin staging
```

Or via GitHub MCP:
```text
create_branch(owner, repo, branch="staging", from_branch="main")
```

### 2. Apply branch protection to staging

Mirror the exact protection rules from `main`. Retrieve the current `main` protection first:

```bash
curl -s -H "Authorization: Bearer $GITHUB_TOKEN" \
  https://api.github.com/repos/{owner}/{repo}/branches/main/protection
```

> **Note**: The example below shows the protection rules for this repository. Use the JSON response from the command above as your payload, adjusting only the `contexts` array if your required checks differ from this baseline.

Then apply the same rules to `staging`:

```bash
curl -s -X PUT \
  -H "Authorization: Bearer $GITHUB_TOKEN" \
  -H "Accept: application/vnd.github+json" \
  https://api.github.com/repos/{owner}/{repo}/branches/staging/protection \
  -d '{
    "required_status_checks": { "strict": true, "contexts": ["validate", "CodeRabbit", "decide"] },
    "enforce_admins": true,
    "required_pull_request_reviews": {
      "dismiss_stale_reviews": false,
      "require_code_owner_reviews": false,
      "required_approving_review_count": 0
    },
    "restrictions": null,
    "required_linear_history": true,
    "allow_force_pushes": false,
    "allow_deletions": false,
    "required_conversation_resolution": true
  }'
```

### 3. Create STAGING_URL repository variable

```bash
curl -s -X POST \
  -H "Authorization: Bearer $GITHUB_TOKEN" \
  -H "Accept: application/vnd.github+json" \
  https://api.github.com/repos/{owner}/{repo}/actions/variables \
  -d '{"name":"STAGING_URL","value":"https://staging.{domain}"}'
```

### 4. Update nightly CI to target staging

In the nightly workflow file (e.g. `.github/workflows/nightly.yml`):

- Change the fallback URL from the production origin to `vars.STAGING_URL || 'https://staging.{domain}'`
- Update the workflow input description from "defaults to production" to "defaults to staging"
- Add a comment that production is never a nightly target
- Update the error message to reference `STAGING_URL` instead of `PRODUCTION_URL`

Also update `test.yml` to trigger on pushes to `staging` as well as `main`:

```yaml
on:
  push:
    branches: [main, staging]
```

### 5. Assign stable Vercel domain alias (manual)

In Vercel → Project → Settings → Domains:

1. Add domain: `staging.{domain}`
2. Assign it to the `staging` branch

Vercel automatically creates Preview deployments for every push to `staging`. The domain alias makes the URL stable for nightly CI targeting.

### 6. Scope analytics tokens to Production only (manual)

In Vercel → Project → Settings → Environment Variables:

1. Find `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN`
   - If it shows "All Environments": click edit → uncheck Preview and Development → save
   - If it is managed by a Vercel integration (shows "Manage Connection"): remove the integration-managed variable, then re-add it manually as a plain env var scoped to Production only
2. Apply the same scoping to `NEXT_PUBLIC_POSTHOG_HOST`
3. Leave `NEXT_PUBLIC_SENTRY_DSN` set for Production and Preview (Sentry stays active on staging for real error visibility)

PostHog guards initialization on `Boolean(token)` — no code change required. Unset token silently skips initialization.

### 7. Update Mergify for staging queues

Add two queue rules to `.mergify.yml`:

- **`staging-integration`**: handles feature PRs targeting `staging` with `merge_method: squash` and the full gate set (`validate`, `test`, `e2e`, `CodeRabbit`, `decide`).
- **`staging-promotion`**: handles the `staging` → `main` promotion PR with `merge_method: merge` (not squash) to preserve conventional commit history for release-please. Requires `validate`, `test`, `decide`.

### 8. Redirect PRs and update framework docs

- Update `CONTRIBUTING.md`: branches are created from `staging`, PRs target `staging`
- Update `AGENTS.md` working rules: feature PRs target `staging`; document the release gate
- Update PR template: add checklist item confirming PR targets `staging`
- Update `ai/MEMORY.md`: record the environment separation decision with date
- Update `docs/QUALITY_STANDARD.md` §4: add the 3-tier environment model as a standard default stack entry
- Update `ai/playbooks/repository-foundation.md` baseline: add `staging` branch, protection, and nightly target

### 9. Verify

- [ ] `staging` branch exists and is protected (verify via GitHub → Settings → Branches)
- [ ] `STAGING_URL` variable is set (verify via GitHub → Settings → Secrets and variables → Actions → Variables)
- [ ] Nightly workflow falls back to staging URL, not production
- [ ] Vercel staging alias resolves and returns the app
- [ ] PostHog token is absent in a Vercel Preview deployment (open the staging app, check network tab — no requests to PostHog ingest)
- [ ] Sentry reports errors from staging with `environment = staging` (or `preview`) tag
- [ ] A feature PR targeting `staging` passes all merge gates and merges cleanly
- [ ] `npm run validate` passes

## Constraints

- Never run nightly CI against the production origin. Automated test traffic generates synthetic events and errors that distort production dashboards.
- Do not use a separate PostHog project for non-production — simply scope the token. Staging metrics are not useful; the goal is clean production signal, not staging observability.
- Sentry should remain active on staging. Real integration failures on staging are worth knowing about; use `environment` tags for dashboard filtering rather than disabling error reporting.
- The `staging` → `main` promotion must use regular merge (not squash). Squashing collapses conventional commits and breaks release-please version detection.
- If PostHog is wired via Vercel integration, the integration-managed variable cannot be scoped per-environment from the edit UI. Remove the integration variable and re-add it manually.

## Related artifacts

- `ai/playbooks/repository-foundation.md` — full baseline including staging setup
- `ai/playbooks/release-management.md` — staging → main promotion and release-please flow
- `ai/playbooks/service-wiring.md` — Vercel env var scoping and staging alias setup
- `docs/QUALITY_STANDARD.md` — 3-tier environment model in §4 default stack
- `.github/workflows/nightly.yml` — nightly CI targeting staging
- `.mergify.yml` — staging-integration and staging-promotion queue rules
