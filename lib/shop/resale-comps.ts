/**
 * Resale comps — eBay price lookup for optional resale validation of a markdown.
 *
 * Primary source is the SerpAPI eBay engine: direct eBay scraping is blocked
 * (403 + captcha) from datacenter IPs like Vercel/DGX, so a raw fetch returns
 * nothing in production. SerpAPI routes around that. Note SerpAPI's eBay engine
 * returns active-listing prices (the LH_Sold filter is not honored), so these
 * over-state true sold value — we apply a conservative haircut and treat the
 * comp as a sanity check on a discount, never the sole reason to source.
 *
 * Each call costs one SerpAPI unit, so the scanner only comps a handful of the
 * deepest markdowns per run (see DEAL_EBAY_COMP / DEAL_MAX_COMPS).
 */

import { serpapiCall } from "@/lib/serpapi";

const RESALE_HAIRCUT = Number(process.env.DEAL_RESALE_HAIRCUT || "0.25");

export interface ResaleComps {
  query: string;
  count: number;
  median: number;
  low: number;
  high: number;
  /** Resale median after the fees+shipping haircut. */
  netMedian: number;
}

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

interface EbayOrganic {
  price?: number | { extracted?: number; raw?: string };
}

function extractPrice(p: EbayOrganic["price"]): number {
  if (typeof p === "number") return p;
  if (p && typeof p === "object" && typeof p.extracted === "number")
    return p.extracted;
  return 0;
}

/**
 * Fetch eBay comps for a query via SerpAPI and summarize. Returns null on API
 * failure or too few data points. Costs 1 SerpAPI unit.
 */
export async function ebaySoldComps(
  query: string,
  minSamples = 4
): Promise<ResaleComps | null> {
  const res = await serpapiCall<{ organic_results?: EbayOrganic[] }>({
    engine: "ebay",
    integration: "deal-scanner-comp",
    params: { _nkw: query, ebay_domain: "ebay.com", LH_Complete: "1", LH_Sold: "1" },
    timeoutMs: 18000,
    costUnits: 1,
  });
  if (!res.ok || !res.data?.organic_results) return null;

  const prices = res.data.organic_results
    .map((r) => extractPrice(r.price))
    .filter((p) => Number.isFinite(p) && p > 1 && p < 100000);
  if (prices.length < minSamples) return null;

  // Trim outliers (top/bottom 15%) so single-battery / accessory listings that
  // share the model number don't drag the median around.
  const sorted = [...prices].sort((a, b) => a - b);
  const trim = Math.floor(sorted.length * 0.15);
  const core = sorted.slice(trim, sorted.length - trim);
  const data = core.length >= minSamples ? core : sorted;

  const med = median(data);
  return {
    query,
    count: prices.length,
    median: med,
    low: data[0],
    high: data[data.length - 1],
    netMedian: +(med * (1 - RESALE_HAIRCUT)).toFixed(2),
  };
}
