# Public Wash & Dry activity

`/wd/activity` is a public, read-only companion to the private `/wd/admin` application. The public API reads only `WdActivitySnapshot`, not customer, payment or messaging tables. Its strict allowlist rejects unexpected fields. First names, predefined city IDs, curated equipment/service labels and dates are the only customer-related values exposed. No full names, streets, contacts, private notes, financial amounts, Stripe IDs or customer coordinates enter the public payload, CSV or share image. The map uses fixed city centers; ambiguous or out-of-area addresses are unplotted.

Install dates come only from the recorded installation field. Stripe subscription starts are separate dated events in Central time and are never called deliveries. Current active/trialing subscriptions are a global snapshot count, not a count of installed machines. Staff/test fixtures, unnamed lost-client placeholders and explicitly unresolved duplicates are excluded without changing source records. Existing service descriptions create curated, undated maintenance notes. The parts catalog has no event dates and never counts as completed repairs. Customer notes and all dollar values remain private.

The supplied spreadsheet required renewed owner Google authentication at the time of the first build. No spreadsheet-only history is claimed; coverage says it is pending. Additional workbook evidence must be reviewed privately before projection, including duplicate identities and real service dates. Never use import timestamps as service dates.

## Refresh

From this checkout, with the authorized database and Stripe environment loaded:

1. `node --env-file=/private/production.env --import tsx scripts/wd-activity/refresh.ts /private/wd-activity` reads existing rental records and the WD Stripe product. It saves private source evidence and a separately allowlisted public snapshot outside the repository. This script never calls the existing WD sync workflow, writes billing records or drafts/sends messages.
2. Review `/private/wd-activity/public-snapshot.json` and its counts. Run `node --env-file=/private/production.env --import tsx scripts/wd-activity/import.ts /private/wd-activity/public-snapshot.json` for validation.
3. Append `--apply` to save. This applies only the additive `WdActivitySnapshot` table SQL and upserts its public snapshot; an existing snapshot is backed up beside the input file. Original WD records are unchanged. The UI displays the snapshot time; no automatic refresh schedule is implied.

Validation: `tsx --test tests/wd-activity.test.ts`, the isolated browser suite, route coverage, link audit and the production build. Browser writes are confined to `tolley_route_test` on localhost:55438. The production smoke test is read-only.
