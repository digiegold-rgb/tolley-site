# Business software offering

`/business` offers custom business software and workflow automation directly with Jared Tolley, remotely worldwide. The first project starts with a repeated operational problem. The public examples cover job paperwork and invoice preparation, photos and inventory, and orders and completed work. They illustrate possible projects, not existing turnkey integrations or guaranteed outcomes.

Prices, timing, ownership/licensing, provider costs, and support are agreed per project. The previously discussed test prices are not published. Existing public work is linked with its current status: Treasure Haul, Tolley Post's simulated demo, and Jelly Studio's public beta. No private customer case or revenue claim is published.

## Inquiry and owner workflow

The form submits `business.request_business_project` through the existing `/api/lead/action` path. A receipt is required before success appears. The existing transaction saves the inquiry, owner customer-history link, and notification outbox. Retries reuse a request ID; errors preserve form values. HQ's inbound board shows the structured fields without a new dashboard or database migration.

Collected fields include workflow, problem, current tools, frequency, business, country, time zone, optional budget/currency and timing. Email is the primary contact for worldwide collaboration; the generic agent action also accepts the existing reachable-phone contact path. Campaign, browser, and customer-reported attribution remain separate. No-JavaScript visitors can read the offer and use email.

## Discovery

Shared offer constants and the registered manifest feed visible service details, FAQs, the service directory, sitemap, generated AI summaries, agent index, capabilities, and sourced public knowledge. The page has a canonical URL, server-rendered text, Service and FAQ structured data, and an Open Graph image. Homepage and navigation links make it reachable. The benchmark includes remote UK paperwork and Australian reseller scenarios.

Crawler response tests are synthetic access checks, not proof of indexing or recommendation. IndexNow can request recrawling after production publication; acceptance does not establish inclusion. Google confirms that ordinary crawlability, internal links, textual content, and matching structured data are the relevant foundation: https://developers.google.com/search/docs/appearance/ai-features

## Verification

Run `tsx --test tests/business.test.ts tests/discovery.test.ts tests/public-knowledge.test.ts`, the normal `npm run build`, and `tests/business-browser.mjs` against the isolated database at `127.0.0.1:55479/tolley_business_test` and app at `localhost:3079`. Never run inquiry mutation tests against production. The browser suite checks actual persistence and outbox/customer linking, failure recovery, retry deduplication, international details, referral separation, mobile layout, no-JavaScript content, discovery endpoints, and the share image.

Run `scripts/discovery-health.ts` against the compiled app and production. The initial isolated run checked 88 URLs: 86 passed, with only `/shop` and `/shop/reviews` missing server headings in the empty test database. Both unchanged routes passed the same read-only document inspection on production. `/business` and its discovery surfaces passed locally.

Rollback is an application revert. No schema or external account changes are required.
