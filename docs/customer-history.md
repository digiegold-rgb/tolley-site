# Customer history and seller discovery

HQ → Customers (`/hq?tab=customers`) is the owner customer memory. Read it before treating chat recollections as current customer facts. It uses existing owner login and MFA, and is separate from subscriber prospect records and T-Agent listing memory.

## Evidence and identity

Saved contact submissions and retained `TLY-` text references connect an inquiry to a browser session. They do not prove who made every click on a shared device. Conflicting reference matches create review events and never merge customers. Timing, IP hashes, carrier and approximate location never establish identity. Owner-confirmed discovery is stored separately from browser and campaign evidence. Missing referral data stays unknown. Pageviews, sessions, browser identifiers, inquiries and customers are separate counts; a quote or booked job is never collected revenue.

The initial two cleanout customers have owner/phone-confirmed quote facts. Their website matches are probable. The 913 customer has a probable ChatGPT-tagged session; the 816 customer's original discovery source remains unknown. Their private source facts are imported from an owner-controlled JSON file, not committed here.

`/homes` remains the canonical real estate page. It now leads with seller representation in the existing Missouri/Kansas service area. Cleanout and estate-sale work is separately quoted. The form uses `request_realtor_consult`, saves a durable receipt and customer link in the same transaction, and uses the existing notification outbox. Public facts feed HTML, metadata, FAQs and generated discovery summaries. Search eligibility cannot guarantee assistant placement.

## Phone history

Spark runs `ops/customer-history/sync.py` over read-only SSH to `mac-mini` once a minute. `mac-read.py` opens SQLite with `mode=ro`; it never sends, marks messages read, changes contacts or controls streams. Only selected one-to-one threads expose content. New-thread candidates contain phone, thread identifier and latest date, not bodies. Start with the two expressly selected customer threads. Review further candidates in HQ.

The pinned `pytypedstream==0.1.0` dependency decodes Apple attributed message bodies without native object unarchiving. It is installed in a separate virtual environment, not vendored. Upstream: https://github.com/dgelessus/python-typedstream (LGPL-3.0-or-later). Decode errors remain visible and fail sync health. GUID upserts reconcile edits and reactions. Retractions clear bodies and photos. Recent messages are revisited each minute; a daily full sweep catches older changes and late downloads. Checkpoints advance after a completed batch including available photos; retries are idempotent. Calls come from the selected phone's synced call history. Call clicks alone do not establish actual calls.

Apple messages are displayed as iMessage/SMS/Phone in Customers. The existing Twilio inbox stays labeled with its own number; its link opens customer history. This connector has no send endpoint. Stopping sync retains history; deleting history tombstones the phone/thread to prevent accidental reimport. Original leads and financial records have their own retention lifecycle.

A dedicated daily `tolley-customer-backup.timer` also uploads the customer tables and protected media key to the existing encrypted backup remote.

Photos up to 4 MB use dedicated AES-256-GCM encryption (`CUSTOMER_MEDIA_KEY`) in the database and owner-authenticated, no-store download/preview routes. This replaces the plan's separate Blob store so customer photos and their metadata are included in the existing database restore. HEIC previews are generated with the Mac's `sips`; originals remain downloadable. No public photo URL is created. Unsupported, unavailable or oversized attachments are explicitly reported in sync health.

## Tracking and retention

The root tracker remains the sole pageview owner. Events have retry keys. Public offering links/buttons/contact clicks are recorded without keystrokes or arbitrary query strings. Persistent browser identifiers expire after 365 days and are disabled by Global Privacy Control or Do Not Track. Session identifiers and approved first/latest referral facts remain separate. Server document handling preserves a bounded landing cookie for the browser tracker; blocked JavaScript, disabled storage, stripped referrals and phone-only contacts can still leave attribution unknown. Browser analytics cannot capture literally every visit.

The text reference is preloaded and editable, with native plain-text-link fallback. iPhone and other SMS URI formats are handled separately. It does not delay the contact gesture or send a message automatically.

`/api/cron/customer-retention` runs daily at 10:45 UTC. It snapshots linked evidence, aggregates anonymous views/interactions into daily totals, then deletes raw anonymous records older than one year transactionally. Saved customer history remains until one year after the owner marks the relationship closed, or owner deletion. Financial records are not deleted by this job. Backups age separately under the existing backup policy.

## Release and recovery

1. Use an isolated checkout; do not reset the shared `/home/jelly/tolley-site` checkout.
2. Test the exact additive `20261013010000_customer_history` migration against the previous schema. Apply only this migration transactionally to production and record its checksum in Prisma migration history. Do not run unrelated pending historical migrations.
3. Configure `CUSTOMER_SYNC_SECRET` and `CUSTOMER_MEDIA_KEY` in production. Keep the protected original in `~/.config/tolley-customer-sync/env` (mode 0600). Never print keys or commit customer facts.
4. Deploy the reviewed application, import the owner-reviewed bootstrap facts with `ops/customer-history/bootstrap.ts`, then install the worker/timer. Historical imports enqueue no notifications.
5. Verify two complete sync cycles, photo decryption, authenticated/anonymous access, public HTML and contact links. Verify encrypted backup upload and a customer-table restore.
6. Roll back the application if needed, stop only `tolley-customer-sync.timer`, and retain the additive tables. Keep the media key for future restores. Do not touch streaming services.

To recover the connector, restore the protected customer config, install the pinned Python dependency into `~/.local/share/tolley-customer-sync/venv`, restore the worker scripts, then enable the user timer. A Mac outage leaves the previous checkpoint and a stale/error status in HQ. No new LLM service or paid provider is required.

## Validation commands

Use only the disposable database at `127.0.0.1:55460/tolley_customers` for mutation tests, and the local app at `localhost:3061`. Real owner credentials are not used by tests.

- `tsx --test tests/customer-history.test.ts tests/discovery.test.ts`
- `DATABASE_URL=<isolated-url> tsx tests/customer-retention.ts`
- `python ops/customer-history/test_decoder.py` (connector virtual environment)
- `DATABASE_URL=<isolated-url> node tests/customer-history-browser.mjs`
- `npm run build`, targeted ESLint, `git diff --check`
- `DISCOVERY_BASE_URL=http://localhost:3061 tsx scripts/discovery-health.ts`

Browser coverage uses real test-account credentials and MFA: access denial, inquiry/outbox idempotence, separate source signals, reference conflicts, selected-thread permissions, GUID edits, encrypted photos/previews, owner memory, responsive rendering, server-rendered facts, unsubscribe and deletion. Retention checks protect saved evidence, aggregate idempotence and relationship expiry. The migration adds only tables, nullable columns, indexes and the event audience default.
