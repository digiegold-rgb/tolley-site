// AI P&L ledger — total cash invested in the AI venture vs actual cash it has
// returned (ads, affiliate, promotions, subscriptions to AI products ONLY).
// Compiled 2026-07-28 from a three-way audit: Gmail receipts, Stripe (all 1,073
// lifetime charges), and local records (Modal CLI billing, Neon DB, memory).
// Product sales (shop flips, estate sales, W/D rent, cleaning) are excluded from
// the "made" side by definition — that's labor/product income, not AI income.
//
// Update this file when a number changes (e.g. a real Anthropic invoice total,
// or the first actual AI dollar earned), then redeploy.

export type PnlLine = {
  label: string;
  amount: number; // USD, positive
  kind: "verified" | "estimated";
  note: string;
};

export const AI_PNL_AS_OF = "2026-07-28";

export const AI_SPEND: PnlLine[] = [
  { label: "DGX Spark (GB10)", amount: 2500, kind: "verified", note: "Hardware, user-stated purchase price" },
  { label: "Claude Code (Anthropic)", amount: 1200, kind: "estimated", note: "$100/mo × ~12 mo — no receipts in Gmail; adjust when console total is pulled" },
  // Regrid: $0 — free month only, never paid (Jared confirmed 7/28; Gmail agrees: no payment receipt ever)
  { label: "Gmail-receipted SaaS", amount: 757, kind: "verified", note: "Gemini auto-reload $100 (4×$25 Mastercard, NOT free credit) · Instantly $94 · Motion $228 · Repurpose $166.83 (Stripe #2335-2248, 2/6/24) · X Premium+ $168 (Stripe #2033-7791, 2/15/24)" },
  { label: "Paid ads (FB + Google)", amount: 430, kind: "verified", note: "$348 FB ad account lifetime + $82 Google Ads; all ads currently off" },
  { label: "ChatGPT", amount: 240, kind: "verified", note: "$20/mo × 12 mo, user-stated" },
  { label: "Modal (GPU compute)", amount: 177, kind: "verified", note: "CLI billing Feb–Jul 2026; July alone $137 (92% of $150 cap) — all Wan video renders" },
  { label: "Vercel Pro", amount: 200, kind: "estimated", note: "~$26–57/mo × ~6 mo" },
  { label: "SerpAPI", amount: 100, kind: "estimated", note: "$25/mo × ~4 mo" },
  { label: "Vendoo", amount: 75, kind: "estimated", note: "$25/mo, cancelled 5/2" },
  { label: "fal.ai + Twilio + ElevenLabs", amount: 65, kind: "estimated", note: "Small usage lines: ElevenLabs $5/mo, Kling test renders, A2P fees" },
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
