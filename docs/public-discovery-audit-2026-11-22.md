# Public responsiveness and AI discovery audit — November 22, 2026

Status: fixes validated in `codex/public-discovery-audit-20261122`; publication in progress. The owner refreshed GitHub authorization on November 22. Live verification follows deployment.

## Scope and live evidence

Read-only Chromium checks covered all 123 URLs in the live sitemap and additional public links/legal pages. Every page was measured at 320, 390, 768, and 1440 CSS pixels. The inventory included service landing pages, 17 blog articles, 33 shop products, the published estate-sale page, and 20 agent-guide pages. Additional checks covered the demo, policies, classic game, pool landing, and intentionally unindexed activity views. No forms, payments, messages, or state-changing browser requests were submitted.

The original 30-target discovery check passed, but it omitted most nested pages. An expanded raw-HTML check covered the sitemap and machine documents. Production findings:

- Washer/dryer subscription inputs exceeded tablet width; the shared layout also affected its policy and activity pages.
- Markets navigation exceeded phone width; signal cards forced unnecessarily wide horizontal scrolling.
- Legal-page decorative lighting caused horizontal overflow. Long agent-guide answers also overflowed phones.
- Six rental/operator legal pages inherited a parent canonical. Blog canonical and article-schema URLs used the redirecting non-www domain.
- The shop, sold gallery, estate-sale detail, demo, and classic game lacked a main heading. The demo lacked its own canonical.
- The archived July estate sale displayed “This weekend” and promised a future address reveal. Date-aware handling also prevents an expired upcoming/live record from continuing to advertise a current sale.
- Cleanouts linked to retired `/junkinjays` and `/moving` pages; they now lead to active property help and rental pages.
- Washer/dryer LocalBusiness structured data omitted the $42 washer-only offer and asserted stock without live inventory evidence. Both plans now use the same price/contact constants as the page, without an unconditional stock claim.
- The Markets snapshot was last updated November 16 while its page promised updates every four hours. The public page now shows the actual snapshot timestamp and avoids claiming real-time data.
- Anonymous `/api/v1/knowledge?q=washer` returned HTTP 200 with zero items. Anonymous retrieval now reads the deployed public service registry directly. It does not require a scheduled learner, stored knowledge, API key, model invocation, or paid task. Authorized/private knowledge behavior retains its existing authorization path.
- Generator and trailer FAQs now share source constants across visible pages, FAQ structured data, agent manifests, and AI summaries. Trailer copy no longer promises automatic insurance coverage.

## Ongoing checks

The existing daily discovery cron is retained; no new schedule is needed. It now checks all canonical sitemap pages (bounded at 500), the agent index, API specification, capability catalog, agent card, and a sourced washer knowledge lookup. It checks actual server HTML for title, main heading, description, canonical, noindex, JSON-LD validity, and service contact details. It evaluates Googlebot, Bingbot, OpenAI search, Claude search, Perplexity, and DuckAssist crawl rules. Three synthetic user-agent requests test edge handling; these are not evidence of actual crawler visits or indexing.

Knowledge query URLs are explicitly allowed by robots, while nested/private API paths remain excluded. Fifteen existing supporting public pages are added to the sitemap. Private applications, retired offerings, and intentionally noindex operational views are not promoted.

Commands:

```sh
node --import tsx --test tests/discovery.test.ts tests/discovery-document.test.ts tests/discovery-estate-card.test.ts tests/public-knowledge.test.ts
DISCOVERY_BASE_URL=http://127.0.0.1:3033 node --import tsx scripts/discovery-health.ts
AUDIT_BASE=http://127.0.0.1:3033 node tests/discovery-public-browser.mjs
npm run build
```

The browser audit accepts `AUDIT_PATHS` (comma-separated paths) and `AUDIT_OUT` for targeted checks. Its default target is production and it blocks non-GET/HEAD browser requests. Reports include metadata, overflow measurements, browser errors, and captured HTML. Treat the current sitemap/catalog as a dated inventory; future product URLs and all possible filter states are not exhaustively covered by one run.

## Validation

- 19 focused tests pass, including public fact retrieval, unknown-question behavior, retained private-route exclusions, canonical inspection, sitemap-driven monitoring, and ended-sale rendering.
- All 16 initially repaired page checks pass at all four widths. Follow-up checks cover the shared FAQs, blog URLs, Markets cards, and activity layout.
- Seven representative service/directory pages retain useful text with JavaScript disabled. The ended sale displays its ended state without JavaScript.
- All four Markets tabs remain within phone width.
- Link audit and company route coverage pass; existing unrelated write-only-model warnings remain.
- Anonymous HTTP lookups return sourced washer, generator, and trailer facts; an unknown query stays empty and invalid bearer authorization returns HTTP 401.
- The development-server version of the full health sweep hit its time limit while Next compiled cold routes. It is not treated as a passing production check; final verification runs against the compiled server.
- Full `npm run build` passes, including its separate TypeScript gate and generation of 594 static pages. Existing unrelated edge-runtime and ffmpeg bundler warnings remain.
- The compiled production server passes all 147 expanded discovery targets, including anonymous knowledge retrieval and crawler policies.
- All 138 sitemap pages in the revised build fit 320, 390, 768, and 1440px viewports, with correct titles, descriptions, canonicals, and main headings.
- The initial simultaneous browser/health sweep encountered transient database connection errors on nine product requests and browser network errors on two product pages. All 147 health targets passed on the subsequent sweep; the two browser pages passed targeted reruns at all four widths. These observations are preserved rather than discarded.
- Summarized live and compiled results are saved in `docs/public-discovery-audit-results.json`; no page/customer contents or credentials are included.

Local validation uses a separate checkout and a database connection configured with `default_transaction_read_only=on`. Production data and the original checkout are unchanged. No schema migration is needed.

## Limits and references

The changes improve retrievability and consistency; they do not enroll Tolley in every assistant or guarantee a recommendation. Published base prices and FAQs do not prove live stock, appointment availability, or provider eligibility. No external business profiles or private customer stories were published.

Google recommends accessible textual content, crawlability, internal links, and structured data consistent with visible content; it does not require an AI text file or guarantee inclusion: https://developers.google.com/search/docs/appearance/ai-features

OpenAI separates search crawling from training: https://developers.openai.com/api/docs/bots

Anthropic documents distinct search and user-retrieval crawlers: https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler
