# Public company profile — November 16, 2026

Tolley.io's homepage and About page introduce the company as an AI software and consumer technology business. The homepage links to the public T-Agent, Animate / Jelly Studio, shop, custom PC, and real estate pages. A root-layout contact footer supplies Tolley.io, Independence, MO, and support@tolley.io on every page.

The company pages use a new ivory, ink, and blue theme. Existing product applications retain their own visual identity and authentication. Product overviews remain public; this release does not make private workspaces or paid actions public.

## Shared facts

`lib/company-profile.ts` supplies the product summaries, contact details, founder background, and audience estimates to the pages, JSON-LD, llms.txt, llms-full.txt, discovery card, and agent index. About already has registry and sitemap coverage. Existing robots rules permit public pages for named AI crawlers.

- Founder name, location, technology focus, approximate 20K TikTok / 30K YouTube audiences, Bitcoin work, and work with million-dollar technology-rich homes were supplied by Jared in the November 16 brief. Audience estimates are dated and are not represented as live API measurements.
- The five-year Apple Genius background and mining-company hardware work were already published on `/pc`.
- Official YouTube and TikTok URLs come from `lib/view-counter.ts`; Whatnot comes from `lib/live/core.ts`.
- The existing About page supplied Ruthann's sourcing and resale background.
- No specific property sale, Bitcoin protocol contribution, award, or customer endorsement is claimed.

## Verification

- `npx tsx --test tests/discovery.test.ts`
- `npm run build` (route coverage, upload syntax, changelog, link audit, Prisma client generation, TypeScript, Next production build)
- `COMPANY_TEST_URL=https://www.tolley.io node tests/company-public.mjs` — read-only, signed-out/no-JavaScript public-page, metadata, contact, discovery and synthetic crawler checks.
- `DISCOVERY_BASE_URL=https://www.tolley.io npx tsx scripts/discovery-health.ts`
- Desktop and mobile browser review of `/` and `/about`.

The read-only production health baseline passed all 28 checks before deployment. Search engine indexing and third-party AI recommendations are external outcomes, not implied by these checks.
