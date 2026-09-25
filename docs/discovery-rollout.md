# Sitewide discovery rollout — September 24, 2026

## What ships
All active registry offerings receive a public details section and /services directory entry; public studio details appear only for signed-out visitors. llms.txt and llms-full.txt are generated from the registry. Price corrections use the same constants as the product pages. The discovery.reviewedAt field means repository review, not live inventory verification.

Attribution separates campaign parameters, browser host, and the customer's own report. Query strings and full referring URLs are not stored in the new attribution payload. First-touch attribution lasts for the browser session. Customer-reported discovery takes precedence in the summary, followed by explicit campaign tags and then browser evidence; the underlying signals remain separate. Call clicks do not establish completed calls.

HQ /hq/discovery uses the existing owner session and MFA checks. Manual phone referrals, related GrowthLead opportunities, stages, and receipt-deduplicated collected revenue are supported. LeadAction inquiries, including Jelly Studio invitations, appear in the inquiry report and can be materialized as opportunities when the owner records an outcome; deterministic IDs prevent counting both records; invitation approval is never counted as booked revenue. The table measures lead cohorts by inquiry date and receipts by collection date. No historical "other" or "direct" traffic is retroactively relabeled as AI.

The existing MCP handler now preserves the server's Request/Response constructors during initialization. Its Node transport adapter was replacing these global classes, causing unrelated NextResponse routes to fail `instanceof Response` validation in a shared production server. A regression test constructs the real SDK transport and verifies existing responses remain valid.

## Rollout and rollback
1. Apply only prisma/migrations/20260924180000_discovery_attribution/migration.sql to the target database before deploying this application. It adds nullable fields and a separate revenue table; no data rewrite. Review migration status first because this checkout contains unrelated work. Use the normal migration deploy when this is the only pending migration. If applying this SQL alone with `prisma db execute`, immediately record it with `prisma migrate resolve --applied 20260924180000_discovery_attribution` so a later deploy does not attempt it again.
2. Deploy the reviewed change set, then run the health and browser checks against that deployment. Do not ship unrelated staged changes from this shared workspace.
3. Vercel schedules /api/cron/discovery-health daily at 11:15 UTC. Existing CRON_SECRET authenticates it. Results are stored as system events and displayed in HQ; no outbound messages or paid service is introduced.
4. Roll back application code if public content or intake fails. Leave additive database columns/table in place to preserve attribution and receipts.

## Commands
- `tsx --test tests/discovery.test.ts`
- `node tests/discovery-browser.mjs` and `node tests/discovery-wd-browser.mjs` — local isolated server/database only
- `tsx scripts/discovery-benchmark.ts` — fixed manual assistant prompt set; save answers/citations/date/platform without claiming rankings.
- `DISCOVERY_BASE_URL=http://127.0.0.1:3019 tsx scripts/discovery-health.ts`
- `npm run audit:links`, `npx tsc --noEmit -p tsconfig.build.json`, `npm run build`

The current cleanouts URL responds successfully; the customer's earlier failure remains unexplained. Browser and HTTP probes complement each other. Search bots are filtered out of human analytics, so historical SiteView rows cannot prove crawler causality. No historic crawler log has been used to attribute this win.

## External profile corrections — draft only
Before editing an external listing, identify the owner-controlled profile and compare its current public facts with the relevant page. Do not assume unrelated businesses belong to Jared.

| Offering | Verified repository correction | Destination |
| --- | --- | --- |
| Washer/dryer | $42 washer / $58 bundle monthly; old manifest said $59/$99 | /wd |
| Generator | FIRMAN T07571, 7,500W running; $68/day, $260/week, $800/month | /generator |
| Trailers | 16/18/20ft utility trailers and 20ft car hauler; old manifest listed different enclosed sizes | /trailer |
| Moving supplies | 20 totes, 17 bands, 25 blankets; $38/day | /moving |
| Kerplunk | Giant yard game rental at $18/day, not furniture rental | /kerplunk |
| Picnic tables | $25/day; deposit and delivery separate | /picnic-table |
| Tables/chairs | $6/table/day; $12/day for a set of four chairs | /tables |
| HVAC | The Cool Guys, 816-726-4054 | /hvac |
| Scrap/junk | Junkin’ Jay’s, 816-206-2897 | /junkinjays |
| Jelly Studio | Usage-based rendering; remove blanket $25/video claim | /animate |

These corrections are implemented on discovery surfaces. External account ownership and live listing contents must be verified before publishing any external edits. The private flagship case study is in business-os/wins/2026-09-24-chatgpt-cleanouts.md.

## Public discovery baseline

A September 24 read-only web search returned the existing [Cleanouts page](https://www.tolley.io/cleanouts) with the business phone and service description, plus [Your KC Homes](https://www.tolley.io/homes) and the [public directory](https://www.tolley.io/start). That confirms retrievable public material, not the source of the customer's original ChatGPT answer. The narrow brand searches did not establish ownership or current contents of external business profiles; external edits remain drafts.

## Implementation validation

- Applied the actual additive migration to an isolated PostgreSQL test database; legacy inserts remain compatible.
- Ten focused tests pass, covering referral boundaries, separate attribution signals, registry facts, linked opportunities, receipt deduplication, crawler rules, health failures, and MCP constructor isolation.
- Browser checks pass for mobile Cleanouts, a desktop directory, content without JavaScript, referral retention between pages, one pageview per navigation, owner-only reporting, inquiry storage, and receipt conflicts. The washer/dryer form separately passes failed-save and successful-save checks.
- The repository link audit and TypeScript gate pass. Targeted lint and whitespace checks pass.
- Final production compilation and generation of all 568 pages pass. The final compile used an IPv4-only download setup in the isolated test copy after Google font TLS retries; application source was unchanged.
- All 34 discovery health targets pass on the compiled production-mode app, including robots.txt, sitemap.xml, generated AI summaries, all 29 offerings, and the two synthetic search-crawler probes. Both browser suites also pass against this final build; the MCP initialization fix resolves the unrelated-route response failures.

Local evidence: `/tmp/tolley-discovery-unit-final.log`, `/tmp/tolley-discovery-build-ipv4-final.log`, `/tmp/tolley-discovery-health-production-final.json`, `/tmp/tolley-discovery-browser-production-final.log`, and `/tmp/tolley-discovery-wd-production-final.log`.

The initial implementation above was tested before deployment. Production integration is being released from an isolated branch based on current main; the original shared checkout remains intact. External profile edits remain drafts.


## Production integration — September 25, 2026

Release 1.50.0 is based on main 023b9422911c82f89fca2f484888cdaf52b3dd28, including the recent Cleanouts restoration. The current route policy intentionally retired older offers and restricted several internal pages. Discovery now covers all 17 currently active registered public offerings, including T-Agent; retired and restricted pages are not re-promoted. The sole root pageview tracker, session/audience analytics, request deduplication, lead notification outbox, and owner MFA remain intact. Washer/dryer inquiries keep the current durable LeadAction flow with the new referral fields.

Migration 20260924180000_discovery_attribution was applied transactionally to production and recorded in Prisma migration history on September 25. It only adds nullable fields, a revenue table, and indexes. No other pending migration was applied. The prior ready deployment is dpl_A2PcZRdkT67vtNirAJnUsAJCF5mj for application rollback.

Final deployment URL and live checks will be recorded in /home/jelly/business-os/wins/2026-09-25-discovery-release.md.
