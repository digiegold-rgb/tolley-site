/**
 * Reverse-image ASIN matcher.
 *
 * For products where SerpAPI Amazon text search misses (or product has no
 * usable text title), pass the product image to Google Lens and look for
 * Amazon links in the visual_matches array. Extract ASIN from the URL.
 */

import { serpapiCall } from "@/lib/serpapi";

export interface LensMatch {
  asin: string;
  title: string | null;
  link: string;
  source: "google_lens";
}

const ASIN_RX = /\/dp\/([A-Z0-9]{10})(?:[/?]|$)/i;
const ALT_ASIN_RX = /\/gp\/product\/([A-Z0-9]{10})(?:[/?]|$)/i;

function extractAsin(url: string): string | null {
  const m = url.match(ASIN_RX) ?? url.match(ALT_ASIN_RX);
  return m && m[1] ? m[1].toUpperCase() : null;
}

interface LensVisualMatch {
  link?: string;
  title?: string;
  source?: string;
}

/**
 * Run Google Lens against a public image URL. Returns the first Amazon-domain
 * visual match with an extractable ASIN. SerpAPI's google_lens engine accepts
 * an `url` param pointing to the image; the URL must be publicly fetchable.
 */
export async function matchAsinByImage(
  imageUrl: string,
  context: string = "lens-match"
): Promise<LensMatch | null> {
  const result = await serpapiCall<{ visual_matches?: LensVisualMatch[] }>({
    engine: "google_lens",
    integration: context,
    params: { url: imageUrl },
    timeoutMs: 20000,
  });

  if (!result.ok || !result.data) return null;
  const matches = Array.isArray(result.data.visual_matches)
    ? result.data.visual_matches
    : [];

  for (const m of matches) {
    const link = typeof m.link === "string" ? m.link : "";
    if (!link.includes("amazon.com")) continue;
    const asin = extractAsin(link);
    if (!asin) continue;
    return {
      asin,
      title: typeof m.title === "string" ? m.title : null,
      link,
      source: "google_lens",
    };
  }
  return null;
}
