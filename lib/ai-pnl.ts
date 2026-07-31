// AI P&L ledger — cash invested in the AI venture over the LAST YEAR
// (~Aug 2025 onward, the Anthropic/DGX era) vs actual cash it has returned
// (ads, affiliate, promotions, subscriptions to AI products ONLY).
// Compiled 2026-07-28 from a three-way audit (Gmail receipts, Stripe's 1,073
// lifetime charges, local records); refreshed 2026-07-31 with real receipts:
// Anthropic console total, 24 Anthropic Gmail receipts, Neon invoices
// ($79.57 Apr–Jul), fal.ai topups ($20 + $50), Modal CLI billed cash.
// Product sales (shop flips, estate sales, W/D rent, cleaning) are excluded from
// the "made" side by definition — that's labor/product income, not AI income.
//
// This static file is the BASELINE. Providers with a `provider` key can be
// overridden daily by live rows from /api/hq/ai-spend (pushed by the DGX
// collector ~/growth-engine/ai-spend/collect-ai-spend.mjs). Numbers without a
// provider key still require a manual edit + redeploy.

export type PnlLine = {
  label: string;
  amount: number; // USD, positive
  kind: "verified" | "estimated";
  note: string;
  provider?: string; // stable key — live rows from /api/hq/ai-spend override by this
};

export const AI_PNL_AS_OF = "2026-07-31";

export const AI_SPEND: PnlLine[] = [
  { label: "DGX Spark (GB10)", amount: 2500, kind: "verified", note: "Hardware, user-stated purchase price" },
  { provider: "anthropic", label: "Anthropic (API + Pro)", amount: 678, kind: "verified", note: "Console total $675–680 read 7/31 · 24 Gmail receipts corroborate (Feb 2026 API top-ups, Pro plan since Mar 3) — auto-update needs an Admin API key" },
  { provider: "openai", label: "OpenAI API (OpenClaw)", amount: 488, kind: "estimated", note: "User estimate for OpenClaw bring-up; zero receipts in digiegold Gmail — billed to another email/card. Auto-update needs an Admin key" },
  // Regrid: $0 — free month only, never paid (Jared confirmed 7/28; Gmail agrees: no payment receipt ever)
  // 2024 charges excluded per Jared 7/28 (last-year window only): Motion $228, Repurpose $166.83, X Premium+ $168
  { label: "Gemini API + Instantly", amount: 194, kind: "verified", note: "Gemini auto-reload $100 (4×$25 Mastercard, NOT free credit — auto-reload is ON) · Instantly $94 (Jun–Jul)" },
  { label: "Paid ads (FB + Google)", amount: 430, kind: "verified", note: "$348 FB ad account lifetime + $82 Google Ads; all ads currently off" },
  { label: "ChatGPT", amount: 240, kind: "verified", note: "$20/mo × 12 mo, user-stated" },
  { provider: "modal", label: "Modal (GPU compute)", amount: 128, kind: "verified", note: "Billed CASH Feb–Jul 2026: Apr $3.71 + Jul $124.59 (metered $169 − $30 credits − free storage). Old $177 figure was metered, not cash" },
  { provider: "vercel", label: "Vercel Pro", amount: 200, kind: "estimated", note: "~$26–57/mo × ~6 mo" },
  { provider: "serpapi", label: "SerpAPI", amount: 100, kind: "estimated", note: "$25/mo × ~4 mo" },
  { provider: "neon", label: "Neon (Postgres)", amount: 80, kind: "verified", note: "Invoices Apr–Jul 2026: $7.88 + $19.56 + $20.52 + $31.61 = $79.57, Launch plan, trending ~$30/mo" },
  { provider: "fal", label: "fal.ai (Kling/lip-sync)", amount: 70, kind: "verified", note: "Top-ups: $20 Mar 15 + $50 Jul 30; $42 credit remaining 7/31; one failed invoice (#VBSBBN-00008) pending" },
  { label: "Vendoo", amount: 75, kind: "estimated", note: "$25/mo, cancelled 5/2" },
  { label: "Twilio + ElevenLabs", amount: 45, kind: "estimated", note: "ElevenLabs $5/mo + A2P fees (fal split into its own line 7/31)" },
];

export const AI_EARNED: PnlLine[] = [
  // Zero rows is the finding, verified three ways on 2026-07-28:
  // - Stripe: 0 of 1,073 lifetime charges touch an AI product (11 AI products
  //   live with real prices — T-Agent, Animate, Digest, Kitchen, Launchpad,
  //   CordPort, JGLD — every one at 0 units sold, 0 subscriptions ever)
  // - Neon DB: AmazonStatsSnapshot, AffiliateLink, AmazonSubtag, earnings
  //   import folder — all 0 rows / 0 files; 789 affiliate clicks, 0 sales
  // - YouTube (18.8K subs): no YPP, no AdSense. FB: monetization gated (76/500
  //   followers). TikTok Shop: needs 30k. X: $0 balance.
];

export const AI_SPEND_TOTAL = AI_SPEND.reduce((s, l) => s + l.amount, 0);
export const AI_SPEND_VERIFIED = AI_SPEND.filter((l) => l.kind === "verified").reduce((s, l) => s + l.amount, 0);
export const AI_EARNED_TOTAL = AI_EARNED.reduce((s, l) => s + l.amount, 0);
export const AI_NET = AI_EARNED_TOTAL - AI_SPEND_TOTAL;

// The one asterisk: $1,764 of estate-sale card revenue (7/17–18) was plausibly
// CAUSED by AI marketing (ESN listing, FB posts, haul appraisals) but is
// commission on physical goods — excluded from AI_EARNED under the house rule.
export const AI_ASSISTED_REVENUE = 1764;
