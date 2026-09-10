# T-Agent daily use — release handoff

Branch: `feat/tagent-daily-use-20260909`, based on URL-cleanup commit `4025fa0` and its unreleased security prerequisites. This is local implementation, not a production release. The staged product version is 1.39.0.

Product findings, the first-week trial, and the separate seller-data repair plan are in [the personal-use plan](../product/tagent-personal-use-20260909.md).

## Routes and data

- `/leads`: authenticated Today view, built from private CRM tasks/contacts and explicitly logged results.
- `/leads/overview`: previous cockpit retained for research. Completed/dead workflow stages are excluded from its research shortlist, and sync freshness is based on successful MLS runs.
- `POST /api/leads/daily`: validated capture, existing-contact follow-up, owner-only inquiry adoption, and transactional outcome/reschedule actions.
- `POST /api/leads/daily/setup`: explicit owner-only workspace activation; creates no Stripe subscription. A newly created owner workspace starts with SMS allowance zero.
- No new tables or migration. Reuses LeadSubscriber, Client, CrmTask, CrmActivity and LeadAction. Resolves linked source leads through the existing customer isolation layer.
- No messages, calls, invoices, bulk imports, paid enrichment jobs, or production writes were performed by this work. Calling/email buttons require the user's action; they open a dialer or email composer.
- Dates shown as “today” use America/Chicago. The follow-up input explicitly uses the browser/device's local time and sends an ISO instant. Per-user timezone settings are a later extension.
- Pending work is loaded in bounded batches of 50, with three upcoming tasks. New owner inquiries are limited to the last 30 days and exclude previously adopted IDs before applying the display limit.
- Captures/imports and result logging use deterministic IDs/request UUIDs plus database transactions to prevent duplicate retries. A stale task edit produces a conflict instead of silently claiming success.

## Validation

- `node tests/tagent-daily-use.mjs`: passed. Real action modules and HTTP handlers run against isolated in-memory database fixtures. Covers Chicago/DST boundaries, priority ordering, ownership and owner-only intake, capture/import retries, transactional rollback, completion/snooze retry behavior, future promises, distinct activity counts, input/origin checks, and owner activation. Renders the actual Today component to verify contact actions and absence of owner-only content for customer views.
- These fixtures do not substitute for a real PostgreSQL transaction or authenticated browser test.
- `node scripts/audit-links.mjs`: passed (274 pages, 872 handlers). Existing write-only-model warnings remain.
- `node scripts/check-changelog.mjs`: passed for staged version 1.39.0.
- Focused ESLint: zero errors; two existing warnings in ClientList (unused editingId and an img element).
- Final TypeScript check passed (exit 0). Full build progressed past config parsing but encountered repeated `getaddrinfo EAI_AGAIN fonts.googleapis.com` errors. It was interrupted after the DNS failure (exit 130); no successful production build is claimed. Logs are `/tmp/tagent-daily-types-final.log`, `/tmp/tagent-daily-build.log`, `/tmp/tagent-daily-lint.log`, and `/tmp/tagent-daily-tests.log`.
- `git diff --check` and comparison of `app/gpu` / `app/game` against the cleanup base: passed.
- Read-only connections to both production and the disposable PostgreSQL database failed with PrismaClientInitializationError. No fixture writes were attempted against production.
- GitHub access failed with `Could not resolve host: github.com`; no push or deployment succeeded.

## Build configuration repair

The previous release attempt failed because Next's TypeScript CLI config subprocess returned empty `--showConfig` output. `experimental.useTypeScriptCli: false` selects the installed compiler API for config parsing. A direct invocation of Next's config reader passed with the application's aliases intact, and the subsequent build progressed past that error into webpack optimization.

The mandatory standalone `tsc --noEmit -p tsconfig.build.json` gate in `npm run build` is preserved. Disabling the CLI config reader does not remove type checking from the build pipeline. A successful config read is not a successful full production build.

## Before deployment

1. Complete the prerequisites in `security-release-20260909.md` and `url-cleanup-20260909.md`; do not deploy this stacked branch while those migrations/authentication checks are unresolved.
2. Obtain a successful full production build and run authenticated staging tests against real PostgreSQL.
3. Test two customer accounts plus owner/non-owner sessions. Prove cross-account IDs cannot be read, adopted or completed, and incomplete MFA cannot activate a workspace.
4. In the browser, capture a disposable contact, complete one attempt with a next follow-up, simulate a failed request/retry, reschedule once, and verify exactly one activity/next task. Check the next local day and both mobile and desktop layouts.
5. Confirm inquiry adoption leaves the original HQ request intact and links to `?tab=inbound`. Do not send real outreach for validation.
6. Verify existing lead-detail/CRM task creation appears in Today, and that the contacts screen can edit the “General contact” role.
7. Verify the former research cockpit, existing client/lead pages, GPU and Game. Then publish and run the seven-day personal-use test with current contacts chosen by Jared.

Rollback: revert the daily-use commit. Existing contacts, tasks and activities remain usable in the original CRM; do not delete them during rollback. The optional owner activation record should be reviewed independently from code rollback.
