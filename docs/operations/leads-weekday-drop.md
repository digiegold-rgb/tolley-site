# Weekday scored targets and drafts

The owner Today desk at `/leads` receives up to five draft cards per weekday at 8am America/Chicago. Deploy this branch and set `LEADS_DESK_SUBSCRIBER_ID` to the active owner's existing LeadSubscriber ID to activate it. The subscriber's user email must also pass the existing admin allowlist. An unconfigured cron returns 503. The production deployment uses this setting to select the owner workspace; it never creates or activates customer subscriptions.

`/api/cron/leads-weekday-drop` requires the existing `CRON_SECRET`. Vercel calls at 13:00 and 14:00 UTC on weekdays; the handler only creates a drop during Chicago's 8am hour. This handles both CST and CDT. Use this schedule as the sole draft producer; the standing desk check can remain read-only. Successful runs produce no notification. Failures use HTTP error status and an internal error log; source shortages appear in Today.

Selection merges fresh private MLS captures from the latest successful browser sweep (at most 36 hours old; see [MLS operations](leads-live-mls.md)) with existing completed/partial dossiers from the last 14 days, with motivation scores of 50–100, for Independence MO or Kansas City MO/KS. It considers up to 500 dossiers ordered by score and recency, keeps one per property, and skips sold/pending listings, other workspaces' private leads, dismissed source signals, saved contact/closure statuses, known phone opt-outs, pending follow-ups, and previous draft targets. Pending source-verification tasks can coexist with a draft. A receipt records the candidate cap and any shortfall. Scores rank research signals, not verified seller intent or a promise of near-term cash.

The private Spark MLS browser sweep and existing public signal dossier pipelines provide candidates. In particular, the existing signal bridge caps new dossiers at roughly three/day. This drop does not increase research spending or promise five new dossiers daily. No eligible supply produces a durable 0/5 receipt; retrying the same day's run does not refill or replace an already reviewed batch.

Drafts are private `CrmTask` records of type `seller_draft`, with a validated draft snapshot in description. A transaction-scoped PostgreSQL lock and unique daily receipt make concurrent retries safe. Saving an edit uses optimistic concurrency. Snoozing preserves the draft. Logging an attempt, conversation or appointment completes it and schedules an ordinary follow-up with the user's note. The owner edits/copies, approves and sends outside the app. Nothing writes an outbound sequence, GrowthTouch, Instantly campaign, SMS or email queue, or enrolls anyone in the Digest.

No schema migration is required. Disabling/removing the configured subscriber ID stops new drops and preserves existing drafts and receipts. The Circle/Digest opt-in flow is unchanged.

Validation:

```sh
node tests/tagent-daily-use.mjs
DATABASE_URL=postgresql://postgres@127.0.0.1:55438/tolley_weekday_test node --import /home/jelly/.npm-global/lib/node_modules/tsx/dist/loader.mjs tests/leads-weekday-drop.ts
npx --no-install tsc --noEmit -p tsconfig.build.json
```

The database test requires the dedicated local `tolley_weekday_test` database, initialized with this Prisma schema. It tests concurrent cron calls, top-five ranking, geography/freshness/status/opt-out exclusions, workspace isolation, future-day deduplication, shortfalls, draft edits and conflicts, snooze preservation, touch-to-follow-up, and absence of outbound records. Route tests cover absent/wrong cron secrets and owner configuration; rendering checks show all five drafts alongside the ordinary follow-up desk.
