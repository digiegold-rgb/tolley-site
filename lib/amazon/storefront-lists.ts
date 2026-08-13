/**
 * Live Amazon storefront Idea Lists ("shelves").
 *
 * The storefront was stocked by hand from the /hq/storefront add sheet, so
 * membership truth lives in the same committed sheet-data.json that page
 * renders — an ASIN's shelf here is the shelf the sheet told Jared to put it
 * on. List IDs were read off the live storefront (amazon.com/shop/digitaljared)
 * on 2026-08-13; Amazon assigns them at list creation, so they only change if
 * a list is deleted and rebuilt.
 *
 * "Household Goods" exists on the storefront but not in the sheet (it was
 * created during stocking for overflow), so nothing maps to it here — its
 * items still resolve to their sheet shelf or the root storefront.
 */
import { resolveAmazonSubtag, type AmazonSubtagSource } from "./subtags";
import sheetData from "@/app/hq/storefront/sheet-data.json";

export const STOREFRONT_URL = "https://www.amazon.com/shop/digitaljared";

export const STOREFRONT_LIST_IDS: Record<string, string> = {
  "Cleaning & Laundry": "3SMH10FFLCVD2",
  "Beauty & Personal Care": "3KXTKH59CDRQW",
  "Fitness & Outdoors": "M23CAW8K75B7",
  "Kitchen & Coffee": "2XYPG23E8JCC",
  "Tech & Gadgets": "1R5A0A39JEC59",
  "Baby & Kids": "1E6Z6NT8T0CEO",
  "Treasure Haul Finds": "2ZXJI68DVPDAT",
  "Tools & Garage": "2FAO3LQA38P2E",
  "Home & Lighting": "1FLR1OB0E5YHD",
  "Household Goods": "3HFPX82DKIVFE",
};

let asinToShelf: Map<string, string> | null = null;

function shelfIndex(): Map<string, string> {
  if (asinToShelf) return asinToShelf;
  asinToShelf = new Map();
  for (const shelf of sheetData.shelves) {
    if (shelf.review || !STOREFRONT_LIST_IDS[shelf.shelf]) continue;
    for (const item of shelf.items) asinToShelf.set(item.asin, shelf.shelf);
  }
  return asinToShelf;
}

export function shelfForAsin(asin: string | null | undefined): string | null {
  if (!asin) return null;
  return shelfIndex().get(asin.toUpperCase()) ?? null;
}

/** Tagged URL for a shelf; falls back to the tagged root storefront. */
export function storefrontListUrl(
  shelf: string | null,
  source: AmazonSubtagSource | string | null,
): string {
  const tag = resolveAmazonSubtag(source);
  const listId = shelf ? STOREFRONT_LIST_IDS[shelf] : undefined;
  return listId
    ? `${STOREFRONT_URL}/list/${listId}?tag=${tag}`
    : `${STOREFRONT_URL}?tag=${tag}`;
}

/**
 * The single shelf that best represents a set of picks — the most common
 * shelf among them, but only when it covers a strict majority. A 3-product
 * post spanning 3 shelves gets the root storefront, not an arbitrary one.
 */
export function dominantShelf(asins: (string | null | undefined)[]): string | null {
  const counts = new Map<string, number>();
  let mapped = 0;
  for (const asin of asins) {
    const shelf = shelfForAsin(asin);
    if (!shelf) continue;
    mapped += 1;
    counts.set(shelf, (counts.get(shelf) ?? 0) + 1);
  }
  let best: string | null = null;
  let bestN = 0;
  for (const [shelf, n] of counts) if (n > bestN) [best, bestN] = [shelf, n];
  return best && bestN * 2 > Math.max(mapped, 1) ? best : null;
}
