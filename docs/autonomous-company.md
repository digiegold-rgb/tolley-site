# Tolley agent company

Tolley exposes one public capability catalog across the active offering registry. Agents can retrieve facts, submit durable inquiries, request quoted research, and create narrated videos through the existing studio renderer. `/services/agent` is the public guide; `/hq/company` is the owner/MFA operations view.

## Interfaces

- `GET /api/v1/capabilities`: schemas, current versions, pricing, evidence, public route inventory.
- `POST /api/v1/quotes`: `{capabilityId,input}`; returns an expiring USD quote with provider, service, and binding maximum cents.
- `POST /api/v1/tasks`: `{quoteId,maxCents}`, with a stable `Idempotency-Key` header. Returns 202 and a polling URL. Repeat the exact request/key after a network failure.
- `GET /api/v1/tasks/:id`, `POST /api/v1/tasks/:id/cancel`: customer-isolated results and cancellation.
- `GET/POST/DELETE /api/v1/knowledge`: public retrieval and explicitly scoped private customer context. Retraction clears the stored source content.
- `/api/v1/agent-mcp`: stateless MCP Streamable HTTP, configured bearer credentials, JSON responses. Tools cover discovery, quotes, execution, polling, cancellation, and scoped knowledge retrieval. OAuth onboarding is not implemented.

The existing discovery MCP, agent index/card, manifests, OpenAPI, robots, sitemap, and shared public offering sections link into this interface. `npm run company:coverage` checks an explicit classification for every page and route handler. New unclassified routes fail the build. Public discovery is permission and structured accessibility; it cannot compel outside agents to crawl or recommend Tolley.

## Customer authority and settlement

Existing video API keys do not automatically receive company authority. The signed-in customer grants `tasks:read`, `tasks:write`, `knowledge:read`, and optionally `knowledge:write` through `/services/agent`, with a monthly ceiling. Every paid task requires an accepted quote and purchased prepaid balance. New `jly_company_` keys are rejected by legacy video execution routes, preventing a bypass of company task limits. Explicitly enabling an existing studio key preserves its separate legacy permissions; its company ceiling applies only to company tasks. No autonomous card charging is added.

Quotes expire after 15 minutes. Durable reservations share a per-customer transaction lock with studio admission. Company purchases preserve promotional stills credits. Settlement is deduplicated and cannot exceed the accepted maximum; provider failure releases the hold. Running video cancellation waits for provider confirmation. An uncertain provider acknowledgement enters reconciliation without blind resubmission; the worker can recover its job using the immutable project identity or request an owner decision.

Webhook delivery uses the API key's existing webhook URL, five attempts, durable leases, and event IDs. Verify `X-Tolley-Signature` as HMAC-SHA256 over `timestamp.body`, using the hexadecimal SHA256 hash of the original API key as the signing key. Check timestamp freshness and deduplicate `X-Tolley-Event-Id`; polling remains authoritative. No callback redirects are followed.

## Learning and development

The Spark worker runs independent loops for tasks, commands, learning, development, delivery, health, and reporting. Daily learning snapshots current public product facts and fetches public technical sources. Customer research and unmet-demand investigations stay within the customer's audience. Fetched documents and model synthesis are labeled separately from verified product facts; retrieved source text never becomes executable instructions.

Development currently builds declarative fact-based service guides, validates their sources and capability IDs, versions them, and publishes them with canonical URLs and sitemap entries when deployment is enabled. Paused publication retains verified drafts for later promotion. Rollback restores the previous version or withdraws the guide. Unknown work produces a private investigation and a concrete missing-adapter decision. The implementation does **not** autonomously edit arbitrary application source, provision credentials/hardware, or invent paid execution adapters. Those upgrades remain a reviewed engineering workflow.

Policy: $500/month independent experiment budget in America/Chicago; $10 per experiment; two concurrent experiments; three attempts. The present local-model/recipe experiments reserve zero incremental cloud dollars. Existing hosting/hardware costs and customer-funded quoted tasks are separate. The worker's local model gateway is operator-configured and restricted to loopback. No new remote model subscription is required.

## Controls and Telegram

Controls begin disabled in a new database. `PAUSE` stops learning/development/publication while accepted work drains. `ADMISSION off` stops new tasks. `STOP <task-id>` requests cancellation. `RESUME` enables growth. `ROLLBACK <capability-id>` restores or withdraws a guide. `APPROVE/REJECT <decision-id>` records an explicit decision; approval alone does not provision a provider or modify credentials.

Telegram commands have a `COMPANY` or `TOLLEY` prefix to avoid consuming the Governor's existing commands. The optional legacy intake hook is `ops/company/telegram_hook.py`; no getUpdates poller is started. The current bot uses an external gateway at tele.goldenherd.com. Its forwarding connection must send original Telegram updates to `/api/company/telegram` with `X-Tolley-Telegram-Secret` matching `COMPANY_TELEGRAM_WEBHOOK_SECRET`. The receiver checks both owner and chat IDs and deduplicates update IDs. The existing webhook is never replaced by deployment. Both sender and chat must match the configured owner. Replies are durable outbox items. With `COMPANY_SHARED_DIGEST_FILE`, status is written for the existing Governor evening message rather than sending a second scheduled digest.

## Rollout

1. Keep the original shared checkout intact. Build/review in an isolated worktree.
2. Take the encrypted production backup. Restore the application's `public` schema into an isolated PostgreSQL 17 database; Neon-managed extensions/auth schemas are platform dependencies, not provided by stock PostgreSQL.
3. Apply **only** `20261018010000_autonomous_company/migration.sql` transactionally, then record it in Prisma migration history. Never deploy unrelated pending migrations. The migration is additive and includes database constraints on money amounts and a knowledge search index.
4. Deploy the reviewed application. Keep task admission off until runtime credentials, public discovery checks, and worker heartbeat pass.
5. Set `COMPANY_CREDITS_ENABLED=1` in both production web and worker environments after the migration. Check existing active paid renders before enabling shared holds; avoid an admission window with old binaries.
6. Install the user service from `ops/company/tolley-company.service`. Its protected environment file must contain the production database, existing renderer credentials, local model endpoint/model, Telegram owner routing, and the company flags. Never commit this file.
7. Connect/test forwarding from the existing Telegram webhook gateway, activate controls, verify real HTTP/MCP discovery and tenant isolation, and record the exact deployment/commit and live results. A 24-hour observation period must elapse before claiming soak acceptance.

Rollback: pause admission/growth, let submitted jobs reconcile, stop the company service if needed, and restore the prior application deployment. Keep additive tables, receipts, and ledger entries. Do not restore an old database over subsequent customer activity.

## Validation

`tests/company-integration.ts` is guarded to the disposable localhost:55463/tolley_company database. It covers concurrent spending and idempotency, tenant boundaries, cancellation, quoted video settlement, promotion-credit isolation, private-context retraction, verified guide release/rollback, shadow promotion, concurrent command deduplication, expiry, stale leases, experiment budgets, scoped keys, real MCP initialization, and public-network restrictions. Its rendered-video fixture verifies accounting, not actual provider availability. Production paid-render acceptance and the observation period are separate checks.

Use the existing discovery/customer-history regressions, TypeScript gate, build, link audit, mobile/desktop browser checks, and discovery-health checks as well. Operational evidence belongs in the private deployment record; customer payloads, keys, and database dumps do not belong in Git.
