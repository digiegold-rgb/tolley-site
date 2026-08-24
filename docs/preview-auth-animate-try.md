# DO NOT MERGE — preview Auth.js notes (try-five)

Temporary notes for Jared on `cursor/animate-try-five-previews-0936` / PR #74.
This file must not land on `main`.

## Root cause

- Auth.js v5 did not set `trustHost`, and Preview env can pin `AUTH_URL` /
  `NEXTAUTH_URL` to `https://tolley.io`. Sign-in cookies and magic-links then
  target production instead of this `*.vercel.app` host.
- Vercel Authentication SSO is on for `all_except_custom_domains`.
  `*.vercel.app` needs a share link / SSO first. Custom domains like
  `tolley.io` are exempt.
- There is **no** Google NextAuth provider and **no**
  `/api/auth/callback/google`. Login is Credentials (email/password) plus
  Email magic-link.

This branch patches `auth.ts` only: `trustHost: true`, and on
`VERCEL_ENV === "preview"` it clears `AUTH_URL` / `NEXTAUTH_URL` so Auth.js
uses the request host. `AUTH_SECRET` is left alone. No Google provider added.

## Jared clicks NOW (signed-out)

Open the Vercel **share** URL first (SSO / deployment protection), then:

- [/animate](/animate) — public landing
- [/animate/demo](/animate/demo) — signed-out studio walkthrough (already exists)

Preview-only index (404 outside Preview): [/dev/try-five](/dev/try-five)

## Jared for full studio

1. Open the share URL (SSO) first.
2. Then [/login?callbackUrl=/animate](/login?callbackUrl=/animate)
3. Use **email/password** (Credentials).

Magic-link still needs this code patch (Preview `AUTH_URL` unset) **and**
working `EMAIL_*` env on the Preview deployment.

## YouTube connect (separate from NextAuth)

YouTube Google OAuth builds the redirect from the request origin:
`${origin}/api/social/oauth/youtube/callback`.

If testing YouTube connect on this preview, add these **YouTube app**
(not NextAuth) redirect URIs in Google Cloud:

- `https://tolley-site-b8s4achmi-digiegold-4652s-projects.vercel.app/api/social/oauth/youtube/callback`
- `https://tolley-site-git-cursor-animate-eae9e2-digiegold-4652s-projects.vercel.app/api/social/oauth/youtube/callback`

## Optional Preview env (if code delete is not enough)

- `AUTH_TRUST_HOST=true`
- Leave `AUTH_URL` and `NEXTAUTH_URL` **empty for Preview only**
- Do not change Production env

## DO NOT MERGE
