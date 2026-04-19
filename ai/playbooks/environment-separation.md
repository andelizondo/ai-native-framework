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
| Create `STAGING_URL` repository variable | GitHub REST API (`GET` / `PATCH` / `POST` on `/actions/variables`) | Automated with token |
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

> Note: the payload below is an example from this repository's current baseline. Reuse the JSON returned by the `main` protection `GET` above, save it to a file or variable, then adjust any branch-specific fields before the `PUT` to `staging`.

```bash
curl -s -X PUT \
  -H "Authorization: Bearer $GITHUB_TOKEN" \
  -H "Accept: application/vnd.github+json" \
  https://api.github.com/repos/{owner}/{repo}/branches/staging/protection \
  -d '{
    "required_status_checks": { "strict": true, "contexts": ["validate", "test", "e2e", "CodeRabbit", "decide"] },
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
# Upsert STAGING_URL so repair and audit reruns stay idempotent.
if curl -sf \
  -H "Authorization: Bearer $GITHUB_TOKEN" \
  -H "Accept: application/vnd.github+json" \
  https://api.github.com/repos/{owner}/{repo}/actions/variables/STAGING_URL >/dev/null; then
  curl -s -X PATCH \
    -H "Authorization: Bearer $GITHUB_TOKEN" \
    -H "Accept: application/vnd.github+json" \
    https://api.github.com/repos/{owner}/{repo}/actions/variables/STAGING_URL \
    -d '{"name":"STAGING_URL","value":"https://staging.{domain}"}'
else
  curl -s -X POST \
    -H "Authorization: Bearer $GITHUB_TOKEN" \
    -H "Accept: application/vnd.github+json" \
    https://api.github.com/repos/{owner}/{repo}/actions/variables \
    -d '{"name":"STAGING_URL","value":"https://staging.{domain}"}'
fi
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

### 9. Database tier (Supabase)

The 3-tier model also applies to the database. The same boundary that scopes Vercel envs and analytics tokens must scope hosted Supabase projects, otherwise staging app traffic mutates production data.

#### 9.1 Project shape

- **One Supabase project per environment.** Provision two projects in the same Supabase organization:
  - `<product>-staging` — receives every migration on push to `staging`
  - `<product>-production` — receives every migration on push to `main`, gated by a GitHub Environment with required reviewers
- Same region as your Vercel deployment; same Postgres major version on both.
- Production should be on the Pro plan (daily backups, no auto-pause, log retention) once the product carries real users. Staging on Free is fine.

Provisioning can be done via the Supabase MCP (`create_project`) once the MCP is authenticated, or manually in the Supabase dashboard. Capture for each project: project ref, anon key, service-role key (only if used), and DB password.

#### 9.2 GitHub secrets

| Scope | Name | Value |
|---|---|---|
| Repository secret | `SUPABASE_ACCESS_TOKEN` | One personal access token from your Supabase account; works for both projects |
| Environment `Staging` | `SUPABASE_PROJECT_REF` | Staging project ref (the `xxxx` in `xxxx.supabase.co`) |
| Environment `Staging` | `SUPABASE_DB_PASSWORD` | Staging DB password |
| Environment `Production` | `SUPABASE_PROJECT_REF` | Production project ref |
| Environment `Production` | `SUPABASE_DB_PASSWORD` | Production DB password |

Create the GitHub Environments first (`Settings → Environments → New environment`), then add the secrets. Reuse the existing Vercel-created `Production` environment (don't reuse `Preview` for the data tier — `Preview` covers every PR's preview deployment, not the long-lived staging branch only). Add `Required reviewers` to `Production` so the `migrate-production` job pauses for human approval before applying.

#### 9.3 CI workflow

`.github/workflows/supabase-migrate.yml` provides three stable check names that downstream automation can require:

| Check | Trigger | What it does |
|---|---|---|
| `migrate-validate` | every PR | Spins up a temporary local Supabase, applies all committed migrations, runs `supabase db lint`. No-ops with a passing check when the PR does not touch `products/dashboard/supabase/**`. |
| `migrate-staging` | push to `staging` | `supabase link --project-ref` (staging) + `supabase db push` against the staging project. |
| `migrate-production` | push to `main` | Same against the production project, gated on the `production` GitHub Environment. |

`.mergify.yml` requires `migrate-validate` on the `staging-integration` queue and `migrate-staging` on the `staging-promotion` queue. The promotion PR cannot merge until staging has successfully received every migration on its current head SHA.

#### 9.4 Vercel env-var scoping (manual)

In **Vercel → Project → Settings → Environment Variables**, set per environment:

- **Production** scope:
  - `NEXT_PUBLIC_SUPABASE_URL` → production project's URL
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY` → production project's anon key
  - `SUPABASE_SERVICE_ROLE_KEY` → production project's service-role key *(only if server code needs admin access — otherwise omit and rely on RLS)*
- **Preview** scope:
  - `NEXT_PUBLIC_SUPABASE_URL` → staging project's URL
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY` → staging project's anon key
  - `SUPABASE_SERVICE_ROLE_KEY` → staging project's service-role key *(if used)*
- **Development** scope: same as Preview, or point at a local `supabase start` URL if developing offline.

Critical: never set the same Supabase URL across Production and Preview. Doing so collapses the data-tier boundary and lets Playwright/staging traffic mutate production rows.

#### 9.5 Migration discipline (forward-only, backwards-compatible)

`migrate-production` runs in parallel with the Vercel production deploy on push to `main`. There is a brief window where the new app code might hit a not-yet-migrated DB (or vice versa). Two rules keep this safe:

- **Additive only across a release boundary.** New columns/tables/indexes/policies are fine. Dropping a column or table that the previously deployed app still reads is not. If you must remove something, ship the code change to stop reading it first, release, then drop in a later release.
- **Migrations are not rollback-safe.** `supabase db push` has no automated down-migration. Treat schema as forward-only; recover from a bad migration with a corrective migration, never by reverting the file.

#### 9.6 First-time bootstrap on an existing schema

If either project already had migrations applied manually before this workflow existed, mark them as applied in `supabase_migrations.schema_migrations` so the first CI run does not try to re-run them:

```bash
cd products/dashboard
supabase login
supabase link --project-ref <ref>
supabase migration repair --status applied <timestamp>   # repeat per migration
supabase migration list --linked                         # verify
```

### 10. Verify

- [ ] `staging` branch exists and is protected (verify via GitHub → Settings → Branches)
- [ ] `STAGING_URL` variable is set (verify via GitHub → Settings → Secrets and variables → Actions → Variables)
- [ ] Nightly workflow falls back to staging URL, not production
- [ ] Vercel staging alias resolves and returns the app
- [ ] PostHog token is absent in a Vercel Preview deployment (open the staging app, check network tab — no requests to PostHog ingest)
- [ ] Sentry reports errors from staging with `environment = staging` (or `preview`) tag
- [ ] A feature PR targeting `staging` passes all merge gates and merges cleanly
- [ ] `npm run validate` passes
- [ ] Two Supabase projects exist (one staging, one production), with secrets set on the matching GitHub Environments
- [ ] First push to `staging` shows a green `migrate-staging` check and the migrations appear in the staging project's `Database → Migrations` tab
- [ ] `staging` → `main` promotion PR shows `migrate-staging` as a required check and cannot merge without it
- [ ] First push to `main` pauses on the `production` GitHub Environment for required reviewer approval before applying
- [ ] Production Vercel env points at the production Supabase project; Preview Vercel env points at the staging project; the URLs are different

## Constraints

- Never run nightly CI against the production origin. Automated test traffic generates synthetic events and errors that distort production dashboards.
- Do not use a separate PostHog project for non-production — simply scope the token. Staging metrics are not useful; the goal is clean production signal, not staging observability.
- Sentry should remain active on staging. Real integration failures on staging are worth knowing about; use `environment` tags for dashboard filtering rather than disabling error reporting.
- The `staging` → `main` promotion must use regular merge (not squash). Squashing collapses conventional commits and breaks release-please version detection.
- If PostHog is wired via Vercel integration, the integration-managed variable cannot be scoped per-environment from the edit UI. Remove the integration variable and re-add it manually.
- One Supabase project per environment is non-negotiable. Sharing a project across staging and production collapses the data-tier boundary and lets test traffic mutate production rows.
- Database migrations are forward-only and must be backwards-compatible across a release boundary. The `migrate-production` job runs in parallel with the Vercel production deploy; destructive changes in the same release as the code that depends on them will produce a brief outage window.

## Related artifacts

- `ai/playbooks/repository-foundation.md` — full baseline including staging setup
- `ai/playbooks/release-management.md` — staging → main promotion and release-please flow
- `ai/playbooks/publish-to-production.md` — canonical operating loop for the governed `staging` -> `main` promotion PR
- `ai/playbooks/service-wiring.md` — Vercel env var scoping and staging alias setup
- `docs/QUALITY_STANDARD.md` — 3-tier environment model in §4 default stack
- `.github/workflows/nightly.yml` — nightly CI targeting staging
- `.github/workflows/supabase-migrate.yml` — database tier CI (validate / apply-staging / apply-production)
- `.mergify.yml` — staging-integration and staging-promotion queue rules (require `migrate-validate` and `migrate-staging` respectively)
- `products/dashboard/supabase/config.toml` — Supabase CLI config (local stack only; hosted project ref injected by CI)
