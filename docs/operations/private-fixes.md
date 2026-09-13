# Private Fixes doorway

`/fixes` uses the existing owner/MFA guard before reading the destination or redirecting. It redirects only to the configured HTTPS `.ts.net` URL. Query parameters never select the destination. Missing or invalid configuration displays an owner-only connection-pending page.

Set server-only `FIXES_PRIVATE_URL=https://tolley-fixes.taile5cde9.ts.net/` in the production environment. The board runs in the separate private repository `digiegold-rgb/recon-triage`, on Spark behind Tailscale Serve. Account records and triage APIs remain there; Tolley forwards no session or account data. A second access boundary at Spark checks the Tailscale identity.

Validation: URL allowlist test, targeted ESLint, production TypeScript check, changelog and link audit. To disable the doorway, remove the environment variable and redeploy; the private board remains unaffected.
