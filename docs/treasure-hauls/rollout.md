# Treasure Hauls campaign rollout

This release extends `/live` and `/stream/growth`. It keeps the house stream director unchanged. Read `~/stream-director/agents/STREAM-AGENTS.md` before any stream operation.

## Data and compatibility

Apply only `prisma/migrations/20260927190000_hauls_campaign/migration.sql`, then record it in Prisma history. Existing future show records become confirmed; historical live windows are preserved for clip association. New show records start as scheduled drafts. `confirmedUntil` retains its original meaning: actual platform-live confirmation, never schedule confirmation.

New tables store campaign drafts/publication status and verified past deals. `LiveShow.metrics` stores source-labeled reported audience numbers. Buyer details are excluded. `campaignPaused` starts true. Existing clip publishing and bindings remain intact.

## Activation

1. Run campaign unit/database/browser tests and the discovery tests, TypeScript, link audit and production build against the isolated database.
2. Apply the additive migration and deploy the code. Verify public hub, artwork, redirects, owner gates, and authenticated campaign heartbeat.
3. Verify exact platform identities before changing bindings. Dedicated Facebook: `1156652300855210`. Dedicated YouTube: `UCqSvlHgO3bKON29JJ5Jw-7g`. Do not bind the connected Your KC Homes Instagram account as Treasure Hauls.
4. Enable campaign mode when the public hub is verified. This replaces legacy Facebook shop daily/weekly/spotlight/guess-price/Amazon-picks posts; Pinterest remains independent. Pause the older product-short and Ruthann repost timers when adopting the show-recording workflow, recording their previous states for rollback. Keep the real show clip timer running.
5. Weekly Facebook crossover posts use separate verified `crossover:facebook:<accountId>` bindings, capped at one per Central calendar week. Other accounts remain manual until verified and bound.
6. Confirm actual upcoming Whatnot links in Growth and prepare the campaign. Review/queue the evening preview; Stories use copy/artwork with native stickers in the platform app. Set the actual live flag only after Seller Hub verification.
7. Begin the first week organically. The $300 allowance does not authorize blind spending: release ad tests only after organic and click baselines exist. No ad purchases are automated.

## Monitoring and rollback

The authenticated cron runs every five minutes and records `campaign_heartbeat`. The existing cron monitor reads that timestamp. Post attempts enter the Posts ledger; failures/ambiguous sends remain visible in Growth. The weekly CSV separates site visits, show/referral clicks, reported viewer metrics, orders, sales and contribution.

Paused, held, canceled, expired and uncertain records do not auto-publish. Unknown remote results require reconciliation with a real post link. A request already in flight can finish after pause.

To stop this campaign, pause its queue in Growth. To stop clip posts, use the separate existing clip pause control. Restore the prior product-short/repost timer states only if reverting the content strategy. Application rollback can leave additive tables/columns in place. Never delete source recordings or stop an active house stream to roll back marketing.
