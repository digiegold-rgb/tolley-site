# Treasure Hauls content income

Owner dashboard: `/hq/content-income`. Owner sign-in and MFA are required.

The Facebook Page is `1156652300855210`, Ruthann’s Treasure Haul. The account starts paused. Activation verifies that exact Page through its active Social Suite connection, seeds a rolling 30-day queue, and schedules one text post at 09:30 and one image at 14:30 Central. Thirty original resale topics are adapted into both formats a week apart. Artwork is generated locally from SVG; it incurs no image generation charge.

The five-minute cron shares the existing database reservation lock and two-feed-post daily limit with show campaigns and clips. A queued confirmed preview keeps its evening slot. Old calendar slots expire. A timeout, worker interruption, or response without a verifiable post ID stays uncertain and blocks further original posting until reconciled against Meta. No public submission is automatically retried.

Meta metrics refresh every six hours. Total post views, reactions, comments and shares come from Graph API. Total views are distinct from qualified monetization views. Permission errors are displayed, and missing measurements remain null. Daily Content Monetization earnings are USD estimates with their returned date coverage. They never count as cash received. Actual payouts require dated statement evidence and an idempotent reference; pending, paid and reversed statements remain distinct.

On October 8, Meta Page Eligibility said the Page had not met the criteria to apply for monetization access. The Page had 103 followers. The readable daily earnings endpoint returned two zero-earning days; qualified-view access was denied. This is not proof of active program enrollment or completed payout setup. Verify those independently in Meta before recording them as active.

## Deployment and activation

1. Run `tests/content-income.ts` and `tests/content-income-browser.ts` against the guarded local database on port 55458. Run the normal repository build.
2. Inspect `scripts/apply-content-income-migration.ts` without `--apply`. The additive migration creates four tables; it refuses a partial installation. Apply with an absolute private `--snapshot` path, then record `20261008000000_content_income` with `prisma migrate resolve --applied`. No existing business tables or rows are deleted.
3. Deploy the website and confirm the public artwork route returns JPEG before publication.
4. Using a trusted operator shell with the existing production database environment, run `scripts/content-income-operator.ts enable`, then `sync`, then `publish-due`. The default command is a read-only report after the account exists. The dashboard can pause publishing at any time.

Execute TypeScript operator commands with the repository’s TS loader and `--conditions=react-server`. Never print the Page token or use another brand’s connection as fallback.

The Shop Video Batch cloud worker is separate. Its health check reads current fal.ai credits to clear a previous billing failure after replenishment; it preserves the last known warning if billing cannot be read. The worker keeps existing per-job allowances, durable receipts and zero paid retries. Ready renders still require product/account verification and review before public TikTok publication.
