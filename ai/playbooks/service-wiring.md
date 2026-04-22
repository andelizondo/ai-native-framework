# Service wiring

## Use When

- standing up a new deployment environment
- adding an auth provider
- debugging auth failures caused by dashboard-side configuration or env misalignment

## Inputs

- target domain
- auth providers to enable
- Supabase project ref
- Vercel project details

## Outputs

- aligned Supabase auth config
- aligned local and Vercel env vars
- provider list consistent across code and dashboards

## Steps

1. Check the tooling boundary first: agents can edit files, but Supabase auth config and Vercel env-var scoping are dashboard work.
2. In Supabase, set the Site URL, add `/auth/callback` to Redirect URLs, and configure provider toggles.
3. For magic-link-only flows, confirm the email-confirmation setting matches the intended UX.
4. In Vercel, scope env vars by environment and redeploy after changes.
5. Keep `NEXT_PUBLIC_AUTH_PROVIDERS` aligned with the providers actually enabled in Supabase.
6. For Google OAuth, configure the Google redirect URI, enable the provider in Supabase, and add `google` to `NEXT_PUBLIC_AUTH_PROVIDERS`.
7. If login fails across browsers, check whether PKCE behavior rather than code is the cause.
8. Verify the full env-var and redirect alignment before closing.

## Constraints

- do not search for nonexistent automation tools when the action is dashboard-only
- do not leave provider exposure inconsistent between code and service dashboards
- staging and production env values must stay scoped correctly

## References

- `ai/playbooks/environment-separation.md`
- `products/dashboard/lib/auth/`
