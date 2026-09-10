# Shop dashboard integration into T-Agent

Local implementation on `feat/tagent-daily-use-20260909`, included in the pending
v1.39.0 release. **No production deployment verified by this session.** The request covered the entire Shop dashboard,
not only its probate page.

The live dashboard could not be opened with the available web tool. This audit
used all 14 local dashboard page modules, their navigation, supporting components,
API handlers, authentication, and signal/dossier producers. No claims about live
record counts or current external provider availability are made.

## Destinations

`/leads/tools` is the owner business-tools directory. Each migrated page uses the
existing T-Agent shell, server-side owner/MFA checks, grouped navigation, and
owner-only command-palette entries. Mobile navigation exposes the workspace and
business tools without squeezing the full desktop sidebar into the screen.

| Previous Shop dashboard suffix | T-Agent destination | Group |
| --- | --- | --- |
| `/serpapi/probate` | `/leads/tools/probate` | Seller research |
| `/serpapi/distress` | `/leads/tools/distress` | Seller research |
| `/serpapi/neighborhoods` | `/leads/tools/neighborhoods` | Marketing visibility |
| `/serpapi/maps` | `/leads/tools/maps` | Marketing visibility |
| `/serpapi/ai-overview` | `/leads/tools/ai-overview` | Marketing visibility |
| `/reviews` | `/leads/tools/reviews` | Marketing visibility |
| root | `/leads/tools/inventory` | Commerce |
| `/trends` | `/leads/tools/trends` | Commerce |
| `/arbitrage` | `/leads/tools/arbitrage` | Commerce |
| `/affiliates` | `/leads/tools/affiliates` | Commerce |
| `/amazon-subtags` | `/leads/tools/amazon-subtags` | Commerce |
| `/analytics` | `/leads/tools/analytics` | Business operations |
| `/tools/revenue` | `/leads/tools/revenue` | Business operations |
| `/tools` | `/leads/tools/connections` | Business operations |

All previous dashboard pages permanently redirect with query values, including
repeated parameters, preserved. Internal links, scan-notification destinations,
and relevant cache invalidations point to the new routes. Old and new internal
paths remain excluded from public crawling and shop visitor reporting.

Specialized listing creation, bulk photo ingestion, Amazon batch entry, and
WhatsApp capture remain linked at their existing `/shop` routes. They use the
shared Shop API authorization, which now also accepts the verified owner account
session. Their data and workers were not duplicated. Amazon batch and the public
Shop's owner link now validate authorization instead of trusting cookie presence.

## Workflow integration

- Probate and distress review expose source evidence, possible property/contact
  matches, saved lead links, and an explicit **Add to Today** action. Probate copy
  distinguishes obituary candidates from verified filings or intent to sell.
- Adoption resolves the active owner workspace from the authenticated session.
  The request cannot choose a different subscriber. Owners without an active
  workspace are directed to activate it from Today.
- A serializable transaction saves/reuses the shared Lead, source backlink,
  private CustomerLeadState, one deterministic CrmTask, and one activity.
  Duplicate/conflicting transactions retry within a fixed bound. Replays preserve
  completed tasks and existing private notes rather than reopening/resetting them.
- The initial task asks for source/property/living-contact verification. No
  deceased person's name is used as a fallback contact on newly promoted probate
  leads. No contact details are invented.
- Adoption links an existing signal-generated listing. Later dossier production
  can link a listing back to its adopted lead without replacing a manually chosen
  listing. Promoted signals remain eligible for research; the existing rolling
  daily cap remains unchanged. Adoption itself runs no paid enrichment.
- Failures in the moved data screens show errors instead of treating failed
  requests as empty data or dereferencing an error response as dashboard data.

## Access and compatibility

These tools operate global owner business data, so ordinary subscribers do not
receive their pages, navigation, or commands. Customers retain their existing
private lead/CRM workflows. Each new page checks access independently of its
layout. Incomplete MFA and support impersonation are denied.

Research, neighborhood, review, and arbitrage APIs require owner session access;
their browser mutations require the same Origin. Shared Shop APIs additionally
accept the verified owner session so migrated tools do not need a second PIN
login. Existing PIN authorization for specialized legacy Shop clients remains
supported; this change does not claim to retire PIN access repository-wide.
An incomplete-MFA or impersonated session cannot fall back to a Shop PIN cookie.

## Verification and release

`tests/tagent-tools.mjs` exercises actual route/auth/promotion modules with isolated
fixtures: all 14 redirects, repeated query parameters, role/MFA/impersonation
denials, owner navigation/commands, shared session authorization, request ownership,
private adoption, transaction rollback/retry, deduplication, completed-task and
private-note preservation, and dossier listing linkage. These fixtures are not
a PostgreSQL concurrency test or a browser deployment test.

Existing guide, Today, and URL-cleanup regressions passed with the moved tools.
The focused ESLint check passed with zero warnings/errors. The link audit passed
(291 pages, 873 handlers, 287 static hrefs); existing write-only-model warnings
remain. Changelog v1.39.0, whitespace, and unchanged GPU/Game checks passed.
The final full `tsc --noEmit -p tsconfig.build.json` passed with exit 0.
No new database tables or migrations are added by this integration. It still
depends on the unreleased CustomerLeadState migration and security prerequisites
in `security-release-20260909.md`.

Before deployment, complete a full production build, real PostgreSQL transaction
tests, and authenticated mobile/desktop browser checks. Exercise owner access
without a Shop cookie; deny anonymous, ordinary-customer, incomplete-MFA, and
impersonated sessions; verify redirects and specialized listing-tool continuity.
Use disposable fixtures to adopt both signal types, retry a failed save, finish
one task, and confirm later research attaches to its lead. Check all dashboard
destinations and review/import controls with providers stubbed.

No scans, messages, purchases, listing publications, revenue imports, production
migrations, or deployments were performed during implementation. The current
session still lacks GitHub DNS, Docker access, and local listener permissions,
as recorded in `tagent-daily-use-20260909.md`.

During validation, another process created commit `36af600` from part of the
shared worktree. That commit was preserved; the remaining redirect, API,
navigation, and validation fixes belong to the same integration. Its commit
message is not evidence of a successful deployment. Release the complete
reviewed diff, including the remaining local changes, after acceptance passes.

Rollback reverts code and redirects while preserving source links, private notes,
tasks, activities, and existing business records. Rolling back this integration
does not require deleting data.
