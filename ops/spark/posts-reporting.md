# Posts reporting release 1.37.9

Deploy the site before installing `posts-view-collector.mjs`: its daily refresh reads the authenticated tracked-video endpoint added in this release. No database migration is required. Existing reporting rows are preserved.

Install the following files in the existing Spark jobs, retaining private backups first:

| Repository source | Installed destination |
| --- | --- |
| `posts-view-collector.mjs` | `/home/jelly/growth-engine/view-counter/collect.mjs` |
| `posts-pinterest-analytics.mjs` | `/home/jelly/growth-engine/view-counter/pinterest-analytics.mjs` |
| `posts-x-scrape.mjs` | `/home/jelly/growth-engine/view-counter/x-scrape.mjs` |
| `posts-video-costs.mjs` | `/home/jelly/growth-engine/shorts/push-video-costs.mjs` |

The existing hourly cron remains authoritative. Do not add a duplicate schedule. `VIEW_CHANNELS_ONLY` restricts a manual metrics refresh; YouTube refreshes older tracked videos approximately daily. A rejected push does not advance refresh cursors. Missing metrics preserve earlier records, which expire from current aggregates according to observation date.

Pinterest uses existing account browser profiles and reports platform-estimated impressions. X recognizes `UserOriginalsTimeline` and the new `relationship_counts`/`tweet_counts` fields. Its sampled tweet lifetime counts cannot establish period activity. LinkedIn remains a weekly email-digest source; the newest available digest must keep its own date.

The cost collector's `--dry-run` mode reads source ledgers and provider billing without posting. Estimated video costs, allocated overhead and provider amounts have different scopes. They are not a reconciled profit-and-loss statement and must not be added together. File existence establishes a rendered record, not publication. Existing historic cost records do not expire merely because their update dates are old.

Post report retries deduplicate on the complete event identity. Callers must reuse a stable `runId` on retry. Distinct titles, URLs, statuses and costs remain distinct. Reader deduplication does not delete legacy rows. A reported success is not independent publication verification.

Validation: `tsx --test tests/posts-accuracy.test.ts lib/vater/build-dynamic.test.ts`; TypeScript and focused ESLint; full production build; `tests/posts-accuracy.mjs` against the isolated localhost app/database only. The integration suite deliberately seeds disposable tables and blocks external browser requests. Verify the live authenticated Posts page and metrics after deployment, then inspect collector results and stale counts.

Rollback: restore the previous installed collector backups, then redeploy the prior site version. Private before-refresh metric snapshots are retained under `/home/jelly/.local/state/tolley-posts/20260908/`. Do not restore snapshots over new records without comparing the affected rows.
