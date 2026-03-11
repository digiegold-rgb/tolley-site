/**
 * Lead Scoring Engine for T-Agent
 *
 * Scores listings 0-100 based on seller motivation signals.
 * Higher score = more likely motivated seller = better referral lead.
 */

interface ListingForScoring {
  status: string;
  listPrice: number | null;
  originalListPrice: number | null;
  daysOnMarket: number | null;
  city: string | null;
  zip: string | null;
  propertyType: string | null;
}

export interface ScoreResult {
  score: number;
  factors: Record<string, number>;
  source: string;
  summary: string;
}

/**
 * Score a listing based on seller motivation signals.
 */
export function scoreListing(listing: ListingForScoring): ScoreResult {
  const factors: Record<string, number> = {};
  let score = 0;
  const reasons: string[] = [];

  // 1. Status signals (biggest indicator)
  const status = listing.status?.toLowerCase() || "";

  if (status === "expired" || status === "withdrawn") {
    factors.expiredOrWithdrawn = 30;
    score += 30;
    reasons.push("expired/withdrawn listing");
  } else if (status === "active") {
    // Active is baseline — score comes from other factors
    factors.active = 5;
    score += 5;
  }

  // 2. Days on market (DOM) — longer = more motivated
  const dom = listing.daysOnMarket ?? 0;
  if (dom >= 180) {
    factors.highDOM = 25;
    score += 25;
    reasons.push(`${dom} days on market`);
  } else if (dom >= 120) {
    factors.highDOM = 20;
    score += 20;
    reasons.push(`${dom} days on market`);
  } else if (dom >= 90) {
    factors.highDOM = 15;
    score += 15;
    reasons.push(`${dom} days on market`);
  } else if (dom >= 60) {
    factors.highDOM = 10;
    score += 10;
    reasons.push(`${dom} DOM`);
  } else if (dom >= 30) {
    factors.highDOM = 5;
    score += 5;
  }

  // 3. Price drop — seller reducing = motivated
  if (
    listing.originalListPrice &&
    listing.listPrice &&
    listing.originalListPrice > listing.listPrice
  ) {
    const dropPct =
      ((listing.originalListPrice - listing.listPrice) /
        listing.originalListPrice) *
      100;

    if (dropPct >= 15) {
      factors.priceDrop = 25;
      score += 25;
      reasons.push(`${dropPct.toFixed(0)}% price drop`);
    } else if (dropPct >= 10) {
      factors.priceDrop = 20;
      score += 20;
      reasons.push(`${dropPct.toFixed(0)}% price drop`);
    } else if (dropPct >= 5) {
      factors.priceDrop = 15;
      score += 15;
      reasons.push(`${dropPct.toFixed(0)}% price drop`);
    } else if (dropPct >= 2) {
      factors.priceDrop = 10;
      score += 10;
      reasons.push(`${dropPct.toFixed(0)}% price drop`);
    }
  }

  // 4. Price range — mid-market KC homes = most referral volume
  const price = listing.listPrice ?? 0;
  if (price >= 150_000 && price <= 500_000) {
    factors.priceRange = 10;
    score += 10;
    reasons.push("mid-market price range");
  } else if (price >= 500_000) {
    factors.priceRange = 15;
    score += 15;
    reasons.push("high-value listing");
  }

  // Determine source category
  let source = "mls_active";
  if (status === "expired") source = "mls_expired";
  else if (status === "withdrawn") source = "mls_withdrawn";
  else if (factors.priceDrop) source = "mls_pricedrop";
  else if (dom >= 60) source = "mls_dom";

  // Cap at 100
  score = Math.min(score, 100);

  const summary =
    reasons.length > 0
      ? reasons.join(", ")
      : "standard active listing";

  return { score, factors, source, summary };
}

/**
 * Determine if a listing should generate a lead.
 * Only create leads for listings with meaningful motivation signals.
 */
export function shouldCreateLead(result: ScoreResult): boolean {
  return result.score >= 25;
}

/**
 * Format a lead digest entry for Telegram/Discord.
 */
export function formatLeadDigest(lead: {
  score: number;
  address: string;
  listPrice: number | null;
  daysOnMarket: number | null;
  summary: string;
  listingUrl: string;
}): string {
  const price = lead.listPrice
    ? `$${lead.listPrice.toLocaleString()}`
    : "N/A";

  return [
    `**Score: ${lead.score}/100** — ${lead.address}`,
    `Price: ${price} | DOM: ${lead.daysOnMarket ?? "?"}`,
    `Signals: ${lead.summary}`,
    `Link: ${lead.listingUrl}`,
  ].join("\n");
}
