# Tolley Day

Private dashboard at `/day`. Enter the existing shop PIN through `/api/shop/auth`;
the same signed, HttpOnly `shop_admin` cookie used by TV and Food unlocks the page,
snapshot API and text summary. Every data request checks the cookie server-side.
An ordinary account session alone does not unlock this financial briefing.

## Sources and definitions

- Stripe: W/D product recognition from `lib/wd-product.ts` plus the existing washer
  price in `/api/analytics/stripe`. MRR includes quantities on active and past-due
  contracts, normalized to months before discounts; excludes trials. Today's income
  is all USD charge/payment balance transactions created within the Chicago day,
  gross before fees/refunds, including pending bank availability. Past-dues are open
  W/D invoices past their due date, or attempted automatic collection without a due
  date. No financial writes. Missing access, unsupported currency/interval or
  incomplete pagination produces a stub, never a partial total.
- Cleanouts: today's saved `GrowthLead` quote requests (`offer=cleanout`,
  `source=cleanouts-page`). This is the existing site inquiry database, not a
  tolley-pay lead export. No contacts or attribution are changed.
- Paid pay pages: **stub**. The inspected tolley-pay deployment has checkout-creation
  functions but no verified read-only payment feed. Never call checkout endpoints
  to test status. Supply a documented payment/receipt read source before connecting.
- MLS: same new-status, score-at-least-25 pipeline as `/api/leads/digest`, with the
  top three properties and latest listing sync timestamp. This is the entire new
  pipeline, not just leads created today. No sending cron or health notifier runs.
- Whatnot: latest `LiveShow` with `endedAt`, validated saved ledger. Provisional and
  settled numbers are labeled. **Stub** when no completed show or complete ledger
  exists. No broadcast controls, schedule sync, messages or money movement.
- Calendar: **stub** until an existing calendar and its read authorization are
  available. An unavailable calendar is never described as an empty day.

## Durable cache and cron

The existing PostgreSQL `SiteEvent` table holds one `day_snapshot_heartbeat` JSON record
under a versioned, hashed environment/branch key. No schema migration. Production,
preview branches and local runs use different keys, even if they share a DB.
The row is upserted, not appended; a transaction lock prevents an older concurrent
pull from replacing a newer snapshot. Data is never stored on Spark disk or in
browser persistence. Reads validate the snapshot shape. No service worker caches
private data. Failed cache writes are shown explicitly; cron returns 503.

Vercel cron `/api/cron/day-snapshot` uses `0 11,12 * * *` and checks the Chicago
hour, so it writes at **6 AM CT**: 11 UTC during daylight time, 12 UTC in winter.
The other invocation returns `skipped`. It requires `Authorization: Bearer
CRON_SECRET`, fails closed if unset, and only pulls sources / saves the snapshot.
Vercel schedules run on production deployments; this branch's preview has no
automatic scheduled run. Manual Refresh works in preview. No production deployment
is part of this task. A heartbeat is registered in the existing cron metadata.

Page loads and Siri read the cache. Refresh does a live pull, with a shared 30-second
DB rate limit and same-origin JSON requirement. The page rereads only the cached
snapshot on focus and once a minute. Each source is isolated: failure becomes a
clearly labeled stub. Prior-day snapshots show a stale warning. The timestamp is
the start of the pull; sources may complete up to 25 seconds later.

## Configuration and Siri

Required existing variables: `DATABASE_URL`, `SHOP_ADMIN_PIN`, `AUTH_SECRET`,
`STRIPE_SECRET_KEY`, `CRON_SECRET`. Optional dedicated summary credential:
`DAY_SUMMARY_TOKEN` (generate a random 32-byte secret). Vercel supplies `VERCEL_ENV`
and `VERCEL_GIT_COMMIT_REF`. Configure application variables in the deployment's
environment; never put credentials in URLs, code, manifests or screenshots.

Siri Shortcut: Get Contents of URL `https://www.tolley.io/day/summary.txt` with
method GET and header `Authorization: Bearer <DAY_SUMMARY_TOKEN>`, then Speak Text.
Use the preview origin while testing. Obtain the token privately from Vercel's
environment settings. The token grants only cached text-summary access, not API
refresh or the dashboard. A PIN-authenticated browser can open the same URL without
a token. PINs/tokens in query strings are not accepted. Rotate the dedicated token
in Vercel and redeploy to revoke it. The response always has three briefing lines
when authorized, with stub/stale indicators; missing cache returns 503, denied
access returns 401. All data responses are private/no-store and noindex.

On iPhone Safari, Share → Add to Home Screen uses the `/day` manifest and Apple
icon/meta. Desktop full-screen control appears only where supported. No customer
details appear in the lock screen, summary, manifest or app icons.

## Verification

`node tests/day-dashboard.mjs`, `node tests/shop-auth-pin.mjs`, the repository build
and authenticated browser checks cover money semantics, DST boundaries, fail-closed
authorization, CSRF, three-line summary, cache error reporting and mobile layout.
Use synthetic fixtures for screenshots/tests; never commit live customer data.
