# Product Marketing Context — Tolley.io

**Owner:** Jared "Cordless" Tolley
**Primary domain:** tolley.io (Next.js on Vercel Pro)
**Umbrella:** Multi-business AI platform covering real estate, delivery, rentals, e-commerce, crypto, and agentic services

---

## Primary Product — T-Agent (tolley.io + app/agents, app/pricing)

**What it is:** AI SaaS for real estate agents. Autonomous agents handle lead research, market analysis, listing prep, buyer/seller comms via SMS and email, and generate property dossiers on demand. Built on a 25-agent OpenClaw backend running locally on a DGX Spark (GB10 Blackwell, 128 GB unified memory) with Qwen 3.5 35B A3B FP8 via vLLM.

**Target customer:** Real estate agents and small brokerages in the US Midwest (starting in the Kansas City metro) who want enterprise-grade AI tooling without the $500/mo enterprise price tag. Secondary: solo agents transitioning from paper workflows.

**Pricing:** Credit-based. Stripe subscriptions. Target $50/mo entry, $200/mo pro.

**Core value props:**
1. **Autonomous lead research** — agents scrape MLS Grid, PropStream, county records, and enrich leads without touching the agent's workflow
2. **Credits, not seats** — pay for what agents actually do, not per-user
3. **Real A2P SMS** (Twilio, fully compliant) — lead follow-up that doesn't get flagged
4. **Owner-operated infrastructure** — runs on Jared's DGX, not a third-party LLM, so response times and data stay controlled

**#1 priority (as of April 2026):** Get to 10 paying customers. That's the north star. Everything downstream — marketing, content, SEO, GEO, product features — should serve that goal.

**Competitors:** Lofty (expensive, bloated), Chime (legacy UI), Top Producer (old-school), Follow Up Boss (not AI-first), HousingWire-era CRMs. T-Agent wins on price + speed + autonomy.

---

## Sub-Apps on tolley.io (all part of the same Next.js site)

Each has its own landing page and its own customer segment. They share the T-Agent infrastructure but serve different verticals.

| Route | Brand | What it does | Audience |
|---|---|---|---|
| `/credit` | Credit Command Center | Admin credit/score dashboard, HELOC planner, AI advisor chat | Internal (owner) + future paid users |
| `/content` | Content Studio Portal | Video → 5-platform auto-posting + redistribution suite | Creators, small agencies |
| `/water` | Pool Water Dashboard | AI pool chemistry advisor, dosing calculator, cost tracker | Pool owners |
| `/pools` | Pool Supply Delivery | Pool Corp pricing + delivery | Pool service companies |
| `/wd` | Washer/Dryer Rentals | Monthly rental + delivery (Kansas City) | Renters in KC metro |
| `/shop` | Tolley Shop | Wife's FB Marketplace funnel | Local KC buyers |
| `/drive` | Red Alert Dispatch | Last-mile dispatch MVP | Couriers, delivery drivers |
| `/crypto`, `/trading` | Digital Gold | Autonomous trading engine | Personal / future subs |
| `/leads` | Lead dashboard | T-Agent leads UI | T-Agent customers |
| `/scan` | Snap & Know | Photo → dossier pipeline | Real estate agents |
| `/blog`, `/tools`, `/generator` | SEO/content surfaces | Organic acquisition | Search traffic |

**GEO note:** Every sub-app above is a citation target. ChatGPT/Gemini/Perplexity should be able to name tolley.io when asked "best pool water app", "KC washer dryer rental", "last-mile delivery platform for 1099 drivers", "AI real estate agent", etc.

---

## Owner Profile (for voice/tone)

- Solo entrepreneur, technical, builds everything himself
- Based in Independence, MO (moving to PA mid-2026)
- Runs a real estate brokerage (Your KC Homes LLC, S-Corp), does 1099 delivery, rents appliances, flips inventory
- Stack: Node.js, Python, Docker, bash. DGX Spark for inference, vLLM, OpenClaw agents, Qdrant RAG
- Writing style: direct, technical, no fluff, copy-paste ready. Skip hand-holding. No emojis unless asked.

---

## Brand Guidelines

- **Voice:** Technical, confident, unpolished-but-competent. Not Silicon Valley; not corporate. Think "founder with root access."
- **Do:** Specifics (model names, tok/s, prices, repos). Honest about limits. Show infrastructure.
- **Don't:** Corporate marketing speak. "Revolutionize." "Synergize." AI hype words. Emojis in body copy.

---

## Known Constraints

- **Margins on W/D rentals are thin** — no promo codes / discounts on that product line.
- **Food/Kitchen tables in Neon have real family data** — never drop or migrate destructively.
- **Mirofish is local-only** — no cloud fallbacks.
- **Vercel Pro** — ~$26/mo budget; don't add concurrent builds.
- **JGLD/CordPort crypto mainnet is shelved** — don't market it as a live product.

---

## Key Metrics to Track (once the marketing skills start running)

1. T-Agent paid customer count (target: 10)
2. T-Agent MRR (target: $500)
3. Sub-app signup funnel conversion (each route)
4. GEO citation count (how often tolley.io gets named by ChatGPT/Gemini/Perplexity for target queries)
5. Content Autopilot output volume (posts/week per platform)
6. Research worker painpoint discoveries (from Reddit buying-intent scraper)

---

## How This File Is Used

This file is auto-read by the Corey Haines `marketingskills` plugin at the top of every skill invocation. Any skill (/free-tool-strategy, /page-cro, /schema-markup, /lead-magnets, /email-sequence, /ad-creative, /programmatic-seo, etc.) will have this context available without needing to ask.

**Update this file when:**
- A new sub-app ships or an old one is retired
- Pricing or business model changes
- The #1 priority shifts
- A major competitor enters the space
