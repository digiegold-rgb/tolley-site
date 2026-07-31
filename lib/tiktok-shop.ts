// TikTok Shop economics + probation math for the /hq 🛍 TikTok tab.
//
// Pure module, no DB — the same separation as lib/post-schedule.ts: this file
// says what the numbers MEAN (fee stack, probation targets, margin bands);
// app/api/hq/tiktok-shop assembles what actually happened.
//
// Fee figures sourced 2026-07-30 from TikTok Seller University + FastMoss /
// Dashboardly (full brief: growth-engine/ttshop-economics-brief-2026-07-30.md
// on the DGX). The 6% referral is documented as inclusive of payment
// processing, but third-party calculators disagree — verify against the first
// real settlement statement before trusting net numbers to the cent.

export const TIKTOK_FEES = {
  referralRate: 0.06,
  promoReferralRate: 0.02, // new-seller promo, ~first 90 days
  fbtSingleUnit: 3.58, // 0–4 lb pick/pack, single-item order
  fbtMultiUnit: 2.86, // per unit on multi-unit orders
  defaultAffiliateRate: 0.1,
  returnsAllowanceRate: 0.08,
} as const;

// Probation graduation targets (New Shop Probation Program).
export const PROBATION = {
  matureOrdersTarget: 300,
  windowDays: 60,
  dailyOrderPaceTarget: 5.6, // ~300/60 with slack — also the $5k/mo pace
  lateDispatchMax: 0.05,
  nonBuyerFaultReturnMax: 0.025,
  sellerCancelMax: 0.05,
  negativeReviewMax: 0.015,
} as const;

// The conversion sweet spot — supplier scorecards grade against this band.
export const PRICE_BAND = { min: 20, max: 30, hardMin: 10, hardMax: 50 } as const;

export interface OrderEconomics {
  gross: number;
  referralFee: number;
  affiliateFee: number;
  fulfillmentFee: number;
  netAfterPlatform: number;
  takeRate: number; // platform share of gross
}

export function computeOrderEconomics(
  gross: number,
  opts?: { promo?: boolean; affiliateRate?: number; multiUnit?: boolean },
): OrderEconomics {
  const referralFee = gross * (opts?.promo ? TIKTOK_FEES.promoReferralRate : TIKTOK_FEES.referralRate);
  const affiliateFee = gross * (opts?.affiliateRate ?? 0);
  const fulfillmentFee = opts?.multiUnit ? TIKTOK_FEES.fbtMultiUnit : TIKTOK_FEES.fbtSingleUnit;
  const netAfterPlatform = gross - referralFee - affiliateFee - fulfillmentFee;
  return {
    gross,
    referralFee,
    affiliateFee,
    fulfillmentFee,
    netAfterPlatform,
    takeRate: gross > 0 ? (gross - netAfterPlatform) / gross : 0,
  };
}

export interface ProbationProgress {
  matureOrders: number;
  target: number;
  pct: number;
  ordersLast7: number;
  paceLast7: number; // orders/day over the trailing week
  paceTarget: number;
  onPace: boolean;
  shopOpenedAt: string; // ISO — first live listing date stands in until scrape provides real date
  daysSinceOpen: number;
}

export function computeProbation(
  orderDates: Date[],
  shopOpenedAt: Date,
  now: Date = new Date(),
): ProbationProgress {
  const weekAgo = new Date(now.getTime() - 7 * 86_400_000);
  const ordersLast7 = orderDates.filter((d) => d >= weekAgo).length;
  const paceLast7 = ordersLast7 / 7;
  return {
    matureOrders: orderDates.length,
    target: PROBATION.matureOrdersTarget,
    pct: Math.min(1, orderDates.length / PROBATION.matureOrdersTarget),
    ordersLast7,
    paceLast7,
    paceTarget: PROBATION.dailyOrderPaceTarget,
    onPace: paceLast7 >= PROBATION.dailyOrderPaceTarget,
    shopOpenedAt: shopOpenedAt.toISOString(),
    daysSinceOpen: Math.floor((now.getTime() - shopOpenedAt.getTime()) / 86_400_000),
  };
}

// Supplier scorecard: given a landed unit cost and intended retail, what's
// left after the realistic all-in platform take (fees + affiliate + returns)?
export interface SupplierScore {
  retail: number;
  landedCost: number;
  inBand: boolean;
  econ: OrderEconomics;
  netAfterReturns: number; // after 8% returns allowance
  contribution: number; // netAfterReturns − landedCost
  marginPct: number; // contribution / retail
  grade: "strong" | "workable" | "thin" | "loser";
}

export function scoreSupplierSku(retail: number, landedCost: number): SupplierScore {
  const econ = computeOrderEconomics(retail, { affiliateRate: TIKTOK_FEES.defaultAffiliateRate });
  const netAfterReturns = econ.netAfterPlatform - retail * TIKTOK_FEES.returnsAllowanceRate;
  const contribution = netAfterReturns - landedCost;
  const marginPct = retail > 0 ? contribution / retail : 0;
  const grade =
    marginPct >= 0.4 ? "strong" : marginPct >= 0.25 ? "workable" : marginPct > 0.1 ? "thin" : "loser";
  return {
    retail,
    landedCost,
    inBand: retail >= PRICE_BAND.min && retail <= PRICE_BAND.max,
    econ,
    netAfterReturns,
    contribution,
    marginPct,
    grade,
  };
}

// Supplier pipeline stages, stored in Supplier.notes as a "stage:" marker so
// the existing model needs no migration. parse/format keep the convention in
// one place.
export const SUPPLIER_STAGES = ["researching", "contacted", "sampled", "ordered", "dead"] as const;
export type SupplierStage = (typeof SUPPLIER_STAGES)[number];

export interface SupplierMeta {
  stage: SupplierStage;
  moq: number | null;
  unitCost: number | null;
  targetRetail: number | null;
  freeNotes: string;
}

const META_PREFIX = "ttshop-meta:";

export function parseSupplierNotes(notes: string | null): SupplierMeta {
  const fallback: SupplierMeta = { stage: "researching", moq: null, unitCost: null, targetRetail: null, freeNotes: notes ?? "" };
  if (!notes) return fallback;
  const line = notes.split("\n").find((l) => l.startsWith(META_PREFIX));
  if (!line) return fallback;
  try {
    const parsed = JSON.parse(line.slice(META_PREFIX.length));
    const stage = SUPPLIER_STAGES.includes(parsed.stage) ? (parsed.stage as SupplierStage) : "researching";
    const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null);
    return {
      stage,
      moq: num(parsed.moq),
      unitCost: num(parsed.unitCost),
      targetRetail: num(parsed.targetRetail),
      freeNotes: notes
        .split("\n")
        .filter((l) => !l.startsWith(META_PREFIX))
        .join("\n")
        .trim(),
    };
  } catch {
    return fallback;
  }
}

export function formatSupplierNotes(meta: SupplierMeta): string {
  const line =
    META_PREFIX +
    JSON.stringify({ stage: meta.stage, moq: meta.moq, unitCost: meta.unitCost, targetRetail: meta.targetRetail });
  return meta.freeNotes ? `${line}\n${meta.freeNotes}` : line;
}

// Compliance flags from the 7/30 draft audit — used/open-box has no compliant
// listing path on TikTok Shop US (pre-owned = 5 luxury verticals only), so the
// tab must show which drafts are safe to submit. Keyed by TikTok product ID.
export const LISTING_FLAGS: Record<string, { flag: "sealed" | "open-box" | "used"; note?: string }> = {
  "1732521764231483785": { flag: "open-box", note: "SmallRig — already live, passed review" },
  "1732523311023100297": { flag: "open-box" }, // audio mixer
  "1732523319801778569": { flag: "sealed" }, // pillow
  "1732523320273834377": { flag: "sealed" }, // mini bike
  "1732523322579521929": { flag: "sealed", note: "restricted category — needs lighting qualification" },
  "1732523318916977033": { flag: "open-box" }, // ring light
  "1732523325719351689": { flag: "sealed", note: "ship est $34.55 — check price" },
  "1732523331956150665": { flag: "used", note: "do not submit — keep on eBay/FB" }, // luggage
  "1732523330499023241": { flag: "used", note: "do not submit — keep on eBay/FB" }, // welding helmet
  "1732523334958748041": { flag: "open-box" }, // marine art
  "1732523342826541449": { flag: "used", note: "do not submit — ship est $20 vs $10 price" }, // corsair case
};

export const SELLER_CENTER_URLS = {
  drafts: "https://seller-us.tiktok.com/product/manage?shop_region=US&tab=draft",
  products: "https://seller-us.tiktok.com/product/manage?shop_region=US",
  orders: "https://seller-us.tiktok.com/order?shop_region=US",
  fbt: "https://scm-us.tiktok.com/",
  qualification: "https://seller-us.tiktok.com/compliance/qualification-center?shop_region=US",
} as const;

// Playbook card content — the 3 levers from the 7/30 research brief.
export const PLAYBOOK = [
  {
    title: "New wholesale goods only",
    detail:
      "Used/open-box has no compliant path (opened packaging counts as pre-owned). One-offs stay on eBay/FB/Whatnot. TikTok gets 5–10 repeatable SKUs at $20–30 with depth, supplier-direct into FBT.",
  },
  {
    title: "Exit probation: 300 mature orders / 60 days",
    detail:
      "~5.6 orders/day. Late dispatch ≤5%, non-buyer-fault returns ≤2.5% — FBT keeps both clean. Referral fee is ~2% during the first-90-day promo: cheapest window to buy volume with 15–20% affiliate commissions.",
  },
  {
    title: "Content is ~70% of GMV",
    detail:
      "Daily shop video + 2–3 LIVEs/week. Open affiliate collab at 15–20% with free samples; promote converters to targeted deals. Passive listings are the documented failure mode.",
  },
] as const;
