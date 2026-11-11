# Tolley PC — November 11, 2026

Canonical landing page: `https://www.tolley.io/pc`. The exact uppercase `/PC` redirects to it and preserves campaign parameters.

The service offers custom computers with parts planning/sourcing or assembly using customer-supplied parts. The launch copy uses Jared's stated five years as an Apple Genius, Mac repair experience including $10,000+ machines, store openings, employee training, and custom-built mining equipment. No exact certification title, current Apple authorization, customer reviews, completed-build photos, warranty period, fixed price, or turnaround guarantee is claimed.

Launch defaults are individual quotes and Kansas City/Independence service by arrangement. Customers supply their city; handoff and timing are confirmed directly. The owner can replace these defaults once pricing, service coverage, and handoff preferences are settled. Shared facts and FAQ live in `lib/pc.ts`; the registered action lives in `app/pc/agent.ts`.

The form saves `request_pc_build` through the existing `/api/lead/action` transaction. It collects workload, parts plan, city, budget, optional requested date/parts list, goals, and contact details. A saved receipt is required before showing success. Existing retry keys, owner notification outbox, customer history, and separate referral signals are reused. A preferred date is an inquiry, never an automatic booking or charge. No schema migration or new credentials are required.

The homepage, `/services`, `/start`, sitemap, agent manifest, and generated discovery summaries expose the offering. Search visibility is not a ranking guarantee. The illustration is original vector artwork and is labeled as an illustration, not customer work. `scripts/pc-share.tsx` regenerates `public/pc/share.png`.

## Checks

- `npx tsx --test tests/discovery.test.ts`
- `DATABASE_URL=postgresql://postgres@127.0.0.1:55472/tolley_pc node tests/pc-browser.mjs` against an isolated local app at port 3072. Tests refuse other database hosts, ports, or names. No production credentials are loaded.
- `DISCOVERY_BASE_URL=http://localhost:3072 npx tsx scripts/discovery-health.ts`
- `npm run build`, including route classification, link audit, changelog, Prisma generation, and the TypeScript gate.
- Inspect desktop and 390/320-pixel mobile screenshots in `/tmp/tolley-pc-preview`.

Browser coverage includes both parts paths, optional date handling, failed-save recovery, retry deduplication, owner outbox/customer history, independent attribution signals, invalid action fields, no-JavaScript call fallback, uppercase redirect, public discovery, and horizontal overflow.

November 11 validation: all 11 discovery unit tests passed; the full production build generated 593 pages; the browser workflow passed against both development and production servers; all 30 production-mode discovery health targets passed. Initial cold-development health probes timed out during compilation and were superseded by the production-mode results. Test delivery attempts used no production notification credentials. No test inquiries were written to production.
