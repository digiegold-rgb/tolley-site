# Revenue reliability repair — September 2026

This release repairs capture, payment facts, and operating visibility. It does not establish product demand or replace sales follow-up. Work was isolated from the owner's modified `/home/jelly/tolley-site` checkout.

## What changes

| Area | Previous failure | Result |
| --- | --- | --- |
| Shared production API runtime | MCP SDK 1.25.2 replaced native HTTP globals, causing valid Next responses to fail after MCP initialization | Compatible MCP 1.x dependency updates preserve native Request/Response identity |
| W/D quote and email forms | Analytics was treated as the lead store; failed requests could show success | Durable HQ records, retryable errors, preserved input, duplicate protection |
| Owner alerts | Fire-and-forget delivery could disappear | Transactional per-channel outbox, bounded retries, delivery status in HQ |
| Rental history | Replays could stamp old collections as today's revenue and repeat failures | Stripe's original paid timestamp, current invoice status, replay protection, conservative subscription matching |
| Rental pricing | Equipment acquisition cost appeared as monthly rent | Separate Stripe monthly rate and equipment cost |
| HQ | Operational activity and usage looked like business outcomes | Business landing tab; live subscription status; recorded payments, accrued usage, recorded costs, and uncertainty separated |
| Attribution | Visits, requests, and purchases were disconnected | Session and campaign capture; operator/customer audience classification; signed Stripe checkout confirmations with duplicate protection |
| Mobile | Estate fieldsets and the Leads application shell widened public pages | Contained fieldsets and separate public pricing layout; existing workspace URLs preserved through a route group |
| Public claims | Inconsistent W/D prices, trial promise, outdated plans, unsupported testimonials and comparison examples | Shared W/D prices, accurate payment-method requirement, current plan names, unsupported examples removed |
| Discovery | Sitemap included account flows and invented modification dates | Account/redirect exclusions and authoritative timestamps only |
| Spark operations | Render prerequisites failed after preparation; rapid restart loops; misleading P&L labels | Early ComfyUI health check, failed work retained, bounded retries, collections less recorded ads labeled honestly |
| Finalization and Buckeye | CLI import failure; missing weekly input treated as a crash | Server-compatible finalizer entry point; missing slips become an awaiting-input task |

The notification outbox alerts the owner. Historical recovery does not enqueue alerts or customer marketing. Delivery is at least once: a process crash after provider acceptance can still cause a repeated alert. Five failed attempts become visible failures rather than indefinite retries.

The MCP failure was reproduced under `next start`: unchanged and repaired API routes returned 500 because their `NextResponse` objects failed the framework's native `Response` identity check. The exact fix is present in [MCP SDK 1.26.0's Node transport](https://github.com/modelcontextprotocol/typescript-sdk/blob/v1.26.0/src/server/streamableHttp.ts), which disables Hono's global-object override. `mcp-handler` 1.1.0 accepts that SDK; both versions are pinned to keep the existing 1.x protocol/API contract. Development mode alone did not expose this shared-process failure.

Confirmed checkout events cover W/D payment links opened with the new session reference. Existing subscriptions and purchases without that reference remain unattributed. Anonymous traffic is not automatically a qualified prospect; historical audience values remain `unknown`. Refunds and later subscription collections are not inferred from checkout events.

## Dependency security

The production dependency audit initially reported four critical package findings. Auth.js is updated to `next-auth` 5.0.0-beta.32 / core 0.41.3 / Prisma adapter 2.11.3, addressing the upstream [configuration-error authorization issue](https://github.com/advisories/GHSA-8fpg-xm3f-6cx3) and email normalization fixes. Protobuf is updated within its existing major to 7.6.6. Next.js and its matching lint configuration move to 16.2.11, including the published [Server Actions fix](https://github.com/advisories/GHSA-m99w-x7hq-7vfj) and earlier proxy fixes.

The follow-up production audit reports zero critical findings, with 21 high, four moderate, and two low package findings still open, including propagated dependencies. This release is not a clean security audit. Prioritize compatible transitive patches, then validate the Next/sharp/PostCSS, Nodemailer/Auth.js peer compatibility, and Prisma configuration dependency upgrades separately. Do not accept the audit tool's proposed Auth.js or Prisma downgrades blindly. Package advisories establish affected installed versions, not evidence of a compromise or proof that every vulnerable code path is exposed.

The production build retains the Standard machine's 8 GB allocation. TypeScript runs as a separate mandatory process with a 4 GB heap; the compiler retains the newer main branch's 6 GB budget. `scripts/build-next.mjs` normalizes both inherited heap-option spellings while preserving platform preload hooks. This avoids Next's option parser replacing an explicit command-line cap with an inherited setting when it launches a child process.

Webpack's production disk cache is disabled: its multi-gigabyte cache packs add serialization and deserialization memory. The compiler worker is explicitly disabled, preserving the intended single-compiler configuration even when the Sentry webpack wrapper is bypassed. Page collection remains at one worker. The newer main-branch changes that skip the Sentry build plugin on Vercel and mark HQ/Generate dynamic are retained. Application data caching is separate from this webpack setting.

The final combined configuration passed a full build in Vercel mode in 13m53s, including 557 static pages, under an 8 GiB cgroup limit with swap disabled and a four-core CPU quota. Its measured peak was 6,980,657,152 bytes (6.50 GiB), with zero OOM events. Deployment traces contain all eight required Twilio and Google Analytics runtime files. The heap-option test starts real child processes and verifies both the effective heap and quoted preload hooks. A successful replacement cloud deployment remains a release gate.

## Recovery

The live preview found 10 historical W/D analytics submissions: 4 recoverable, 5 duplicate or already known, and 1 invalid. The four recoverable inquiries were imported after the additive migration, preserving their original dates and creating no notifications. The financial preview matched 47 existing subscription links and 369 existing invoice records; 17 clients lack subscription links and 2 invoices are excluded from automatic correction. The private follow-up review identified 12 active and five inactive local client records; two have candidate subscriptions under the exact stored customer ID. Both excluded invoices exist in Stripe and are marked uncollectible, requiring write-off review rather than an automatic collection retry. These are record counts, not a revenue forecast or a list of delinquent customers.

`scripts/recover-wd-inquiries.ts` defaults to review. `--apply` creates original-dated, deduplicated HQ records and marks their historical origin. Verify consent before contacting them.

`scripts/reconcile-rental-facts.ts` defaults to review. Applying requires `--apply --snapshot /absolute/private/path.json`; it saves before/after values with mode 0600, then updates exactly linked local facts in a transaction with concurrent-change guards. It makes no Stripe mutations, retries no charges, and creates no dunning messages. A paid local record is not changed to unpaid just because Stripe disagrees; offline payments require review.

## Release order

1. Verify the target database and its migration history. `scripts/apply-revenue-migration.ts` reviews readiness by default; `--apply --snapshot /absolute/private/path.json` applies only this migration in a transaction with lock and statement timeouts. Record `20260908020000_revenue_repair` as applied with Prisma's `migrate resolve` after a successful apply. The change is additive; it does not backfill or delete existing records. Do not use `db push --accept-data-loss` on production.
2. Deploy the reviewed branch after the schema is present. Required existing secrets include Stripe, `CRON_SECRET`, and the configured owner email/Discord providers. The new cron is `/api/cron/lead-notifications`, every two minutes. Preview deployments should use isolated data and delivery credentials.
3. Verify an authorized test submission appears once in HQ, and verify the owner-alert channels individually. HTTP success means the record was saved; alert delivery has its own status.
4. Review and apply the historical recovery and financial reconciliation separately, retaining the private snapshot. Resolve ambiguous mappings manually before using the global W/D sync.
5. Review `/hq`, `/hq?tab=inbound`, `/hq?tab=money`, and `/hq?tab=site`. Confirm live Stripe status against the operator's Stripe dashboard. Unverified historical dates are excluded from verified collections until reconciled.
6. The finalizer user-service override invokes `ops/spark/vater-finalize-sweep.sh` from the release checkout, preserving the existing timer's `--apply` behavior. Direct invocation without arguments remains dry-run. The scheduled run at approximately 07:13 CDT on September 8 succeeded: two expired upstream jobs became HQ review tasks, with no clips delivered or charges booked. Replaying unchanged output preserves an already-ready project and its update timestamp.
7. The Buckeye override selects the release checkout and explicitly loads its existing environment, preserving the Sentry cron wrapper. Install its override after `sentry-cron.conf` in lexical order (`zz-revenue-release.conf`); an earlier filename is overridden by that wrapper. Missing W37 slips still need delivery input; the code does not invent invoice line items. Dry-run skips task writes and all notifications, including failure notifications.

Rollback the application release while retaining the additive schema and captured leads. Do not drop the outbox to roll back a UI change. Preserve any pending alerts for review. Financial restoration must compare current values with the saved after-values before restoring preimages, so newer webhooks or manual payments are not overwritten.

## Spark changes already installed locally

- `/home/jelly/growth-engine/lib/render-preflight.mjs` and the product-short integration check ComfyUI before preparation and retain failed assets. The patch is recorded under `ops/spark/shorts-revenue-repair.patch`.
- `/home/jelly/growth-engine/weekly-pnl.mjs` labels collections less recorded ads as a subtotal before costs, identifies missing ad data, and removes amount-only rental classification. Patch: `ops/spark/weekly-pnl-revenue-repair.patch`.
- User-systemd drop-ins for WhatsApp and OnionShare limit retries to five starts per hour with five-minute spacing. The user daemon reloaded successfully. Services were not force-restarted.

The production additive migration was applied and recorded in Prisma history, and four historical inquiries were recovered. The schema snapshot is private under `/home/jelly/.local/state/tolley-revenue/20260908/`. Finalizer and Buckeye service overrides are installed and the user daemon reloaded. The finalizer has completed successfully on its timer. Buckeye's previous failed-run status remains; its corrected command passed dry-run, and the next normal run is September 8 at 20:14:59 CDT. At this release-preparation checkpoint, the application deployment and financial reconciliation are pending. No customer message or charge was performed by these validations or recovery tools.

## Work that needs operating input

| Dependency | Next action | Evidence of completion |
| --- | --- | --- |
| ComfyUI rendering | Choose GPU/memory allocation and restore the intended render service; current services were stopped cleanly | Health check and one authorized representative render complete within the resource budget |
| Pinterest distribution | Owner reconnects the logged-out browser accounts | A reviewed post completes and the channel records a valid session |
| Buckeye billing | Supply and reconcile the missing weekly delivery slips | Invoice draft matches the supplied deliveries |
| Broken subdomains | Review the observed gateway failures for manus, tradingagents, engine, chat-bridge, upload, postiz, action-api, hermes, and media; decide which services remain required | Required endpoints pass their actual authenticated health checks; retired routes have explicit disposition |
| Business margin | Reconcile equipment, repairs, delivery/labor, provider costs, fees, refunds, and offline collections by business | Contribution margin calculated from reconciled inputs; current HQ leaves it unavailable |
| Acquisition and sales | Pick a primary offer, respond to verified inquiries, qualify prospects, track quotes and paid outcomes | Weekly funnel with response time, qualified requests, quotes, wins, collected cash, and delivery costs |

Do not treat the 54 subsite registrations or historical draft inventory as 54 functioning acquisition businesses. Prioritize rental collections and genuine inbound demand, then run one measured acquisition experiment at a time. A working site can capture and measure demand; traffic generation and closing still need an accountable operator.

## Validation

The automated tests use only `127.0.0.1:3018` and a disposable PostgreSQL database at `127.0.0.1:55438/tolley_revenue_test`. Set `WD_ADMIN_PIN_TOLLEY=revenue-test-admin-only` on that isolated server for authenticated HQ checks. Stripe and notification senders are stubbed; browser external traffic and submissions are intercepted.

- `lib/revenue-repair.test.ts`: original invoice dates, unknown dates, normalized recurring rates, failed/non-durable lead responses.
- `tests/revenue-billing.ts`: duplicate invoice failures, delayed failed webhooks after payment, preserved paid dates, subscription isolation, concurrent payment attribution.
- `tests/revenue-mcp.mjs`: native HTTP class identity before/after MCP initialization and a real protocol handshake.
- `tests/revenue-outbox.ts`: durable queue deduplication, retries, parallel leases, successful-channel isolation.
- `tests/revenue-migration.mjs 358872187dbfdb2bb65b301edba04281c1c5c1a0`: full baseline schema plus additive migration in a rolled-back transaction; historical data preserved.
- `tests/revenue-repair.mjs`: durable and concurrent lead capture, protected endpoints, reserved payment events, mobile widths, retained failed-form input, optional local storage, hydration checks.
- `ops/spark/render-preflight.test.mjs`: failed and healthy render prerequisite responses.
- Production build, repository link/changelog checks, and focused lint are release gates.

The full production build passed, including 562 prerendered pages. Existing warnings remain in the unrelated Generate media route exports and ffmpeg module tracing. These are not silently treated as repaired by this release. Pool-page hydration passed locally; the live-site hydration report needs a post-deployment check with the production catalog.
