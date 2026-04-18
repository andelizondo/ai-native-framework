# Service wiring

## Objective

Configure external services (Supabase, Vercel, OAuth providers) so they are ready to support a deployed application environment. This playbook documents what agents can do autonomously, what requires a dashboard, and the exact steps for each.

## When to run

- Standing up a new deployment environment (staging, production)
- Adding a new OAuth provider
- Debugging auth failures caused by misconfigured redirect URLs or missing env vars

## Outcomes

At the end of this playbook:

- Supabase auth is configured with the correct Site URL and Redirect URLs allowlist
- All required environment variables are set in both local `.env.local` and Vercel
- Enabled auth providers match across code (`NEXT_PUBLIC_AUTH_PROVIDERS`), Supabase dashboard, and any OAuth provider console

## Tooling coverage map

Understanding what agents can and cannot do prevents wasted time searching for tools that do not exist.

| Action | Tool available | Where to do it |
|---|---|---|
| Query Supabase database, run SQL | Supabase MCP (`execute_sql`) | Automated |
| Update Supabase auth config (Site URL, Redirect URLs) | **None** | Supabase dashboard |
| Enable/disable Supabase auth providers | **None** | Supabase dashboard |
| Read Vercel projects and teams | Vercel MCP (`list_projects`, `list_teams`) | Automated |
| Add/update Vercel environment variables | **None** | Vercel dashboard |
| Create Google OAuth credentials | No MCP; `gcloud` CLI (if installed) | Google Cloud Console |
| Edit `.env.local` | File tools | Automated |

When the Supabase MCP or Vercel MCP returns no relevant tool for a configuration action, stop searching — the tool does not exist. Go directly to the dashboard.

## Supabase auth setup

### Required dashboard steps (cannot be automated)

Every environment needs these three settings configured in the Supabase dashboard before magic link or OAuth login will work. Skipping any one causes silent auth failure.

**URL Configuration** — [supabase.com/dashboard/project/{ref}/auth/url-configuration](https://supabase.com/dashboard/project/{ref}/auth/url-configuration)

1. **Site URL** — set to the app's canonical origin (e.g. `https://ai-native-framework.app`). If this is wrong, Supabase silently falls back to it for all redirects.
2. **Redirect URLs allowlist** — add `https://{domain}/auth/callback`. If the redirect URL sent by the app is not listed here, Supabase ignores it and uses the Site URL instead. This is the most common cause of "magic link goes to the wrong domain."

**Email provider** — [supabase.com/dashboard/project/{ref}/auth/providers](https://supabase.com/dashboard/project/{ref}/auth/providers)

3. **Confirm email** toggle — disable for magic-link-only flows. When enabled, new users receive a "Confirm your signup" email before they can use a magic link, which creates confusion and an extra failure point.

### Failure signature

When Redirect URLs are not configured correctly the symptom is: the user clicks the magic link in their email and lands on a different domain than the app (typically `localhost:3000` or whatever the Supabase project's Site URL was set to at creation time). The error shown on the login page is "That sign-in link was invalid or has expired."

Check the magic link email directly — the link domain reveals the misconfigured Site URL.

## Vercel environment variables

### Dashboard path

[vercel.com/{team}/{project}/settings/environment-variables](https://vercel.com/{team}/{project}/settings/environment-variables)

Set variables for **Production** (and **Preview** if needed). Variables added here require a redeploy to take effect.

### Auth providers variable

`NEXT_PUBLIC_AUTH_PROVIDERS` controls which auth providers the login UI shows. It is a comma-separated list:

- Magic link only: `magic_link`
- Magic link + Google: `magic_link,google`

This variable must be consistent with what is enabled in the Supabase dashboard. Enabling Google in the code without configuring it in Supabase (or vice versa) causes a broken sign-in button.

## Adding Google OAuth

Three coordinated steps are required. All three must be complete before Google sign-in works.

### Step 1 — Google Cloud Console (manual)

1. Go to [console.cloud.google.com](https://console.cloud.google.com) → APIs & Services → Credentials
2. Create OAuth 2.0 Client ID → Web application
3. Add authorized redirect URI: `https://{supabase-project-ref}.supabase.co/auth/v1/callback`
4. Copy the Client ID and Client Secret

### Step 2 — Supabase dashboard (manual)

1. Go to Authentication → Providers → Google
2. Toggle on, paste Client ID and Client Secret from step 1

### Step 3 — Environment variable (automated for `.env.local`; dashboard for Vercel)

Add `google` to `NEXT_PUBLIC_AUTH_PROVIDERS`:

```dotenv
NEXT_PUBLIC_AUTH_PROVIDERS=magic_link,google
```

Agents can edit `.env.local` directly. Vercel requires the dashboard (no env var management tool in the Vercel MCP; Vercel CLI must be installed separately).

## PKCE and cross-browser behavior

The dashboard app uses `@supabase/ssr` which enables PKCE by default for all auth flows. PKCE stores a code verifier in the browser at the time the magic link is requested. Clicking the link in a different browser or email app will fail because the verifier is absent.

This is expected Supabase PKCE behavior, not a code bug. If cross-browser magic links are required, the Supabase project's auth flow must be changed to the implicit flow — which is a separate architectural decision outside this playbook's scope.

## Env var alignment checklist

Before closing a service wiring task, verify:

- [ ] `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set in `.env.local` and Vercel
- [ ] `NEXT_PUBLIC_AUTH_PROVIDERS` matches the providers enabled in the Supabase dashboard
- [ ] Supabase Site URL matches the app's production origin
- [ ] `/auth/callback` is in the Supabase Redirect URLs allowlist
- [ ] For Google: OAuth client redirect URI in Google Cloud matches `{supabase-ref}.supabase.co/auth/v1/callback`
