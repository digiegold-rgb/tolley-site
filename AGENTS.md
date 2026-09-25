<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Tolley discovery and referral principles

For public-offering work, read `docs/discovery-rollout.md`. The internal flagship case is `/home/jelly/business-os/wins/2026-09-24-chatgpt-cleanouts.md`; the operating playbook is `/home/jelly/business-os/03-PLAYBOOKS/AI-DISCOVERY.md`. Keep that customer story internal.

- Register each offering through `lib/subsites.ts` and give it an explicit discovery disposition. Private applications and redirects must not become public offering entries.
- Keep service descriptions, provider contacts, prices, coverage, and next steps consistent with the product's source constants. A repository review is not live availability verification.
- Put essential facts in server-rendered public HTML. Maintain stable canonical URLs, working contact/intake actions, and sitemap coverage. Generate AI-facing summaries from the same facts.
- Preserve campaign, browser-referral, and customer-reported attribution separately. Calls may happen without a website visit. Show inquiry success only after saving the lead.
- Link related opportunities to the original lead. Count collected revenue once per receipt; an invitation approval or potential home sale is not earned revenue.
- Run the discovery tests and public-page health checks when changing these surfaces. Add meaningful unbranded prompts to the benchmark for new offerings.
- Record evidence and uncertainty. The ChatGPT referral is a customer-reported win; its exact retrieval source and causal code change are unknown. No particular file, schema tag, or crawl permission guarantees recommendations.
