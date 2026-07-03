export const SHOP_CATEGORIES = [
  "Furniture",
  "Electronics",
  "Clothing",
  "Home",
  "Kitchen",
  "Kids",
  "Sports",
  "Tools",
  "Automotive",
  "Toys",
  "Books",
  "Other",
] as const;

export type ShopCategory = (typeof SHOP_CATEGORIES)[number];

export const FACEBOOK_PROFILE_URL =
  "https://www.facebook.com/profile.php?id=534686507";

// Ruthann's Treasure Haul FB Page — created 2026-04-28. Personal profile above
// is still used for direct Marketplace listing deep-links (BuyButton); the Page
// URL below is for "Follow" / "Message the brand" CTAs.
//
// If the vanity username `RuthannsTreasureHaul` cannot be reserved at create
// time, replace with the assigned page id URL: facebook.com/<numeric-id>
export const TREASURE_HAUL_FB_URL =
  "https://www.facebook.com/RuthannsTreasureHaul";

export const TREASURE_HAUL_MESSENGER_URL =
  "https://m.me/RuthannsTreasureHaul";

/**
 * Build the canonical FB Marketplace listing URL for a given numeric ID.
 * Buyers landing here can hit the built-in "Message Seller" button.
 */
export function fbListingUrl(fbListingId: string | null | undefined): string | null {
  if (!fbListingId) return null;
  if (!/^\d+$/.test(fbListingId)) return null;
  return `https://www.facebook.com/marketplace/item/${fbListingId}/`;
}

/**
 * Default Amazon Associates tag. Server-side reads AMAZON_AFFILIATE_TAG.
 * Hardcoded fallback matches the production tag so admin tools work even
 * when the env var hasn't been pulled into local dev.
 */
export const AMAZON_AFFILIATE_TAG_FALLBACK = "tolley-shop-20";

export function resolveAmazonTag(tag?: string | null, source?: string | null): string {
  if (tag) return tag;
  if (source) {
    // Imported lazily via require to keep the call cheap when source is null
    // (which is the common /shop button case). Static import would be fine too.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { resolveAmazonSubtag } = require("./amazon/subtags") as typeof import("./amazon/subtags");
    return resolveAmazonSubtag(source);
  }
  if (typeof process !== "undefined" && process.env.AMAZON_AFFILIATE_TAG) {
    return process.env.AMAZON_AFFILIATE_TAG;
  }
  return AMAZON_AFFILIATE_TAG_FALLBACK;
}

/**
 * Amazon Associates affiliate URL. ASIN is the 10-char product ID.
 *
 * Pass `source` (e.g. "tt", "yt", "shop", "bounty") to attribute the click
 * to a specific tracking sub-tag. Falls back to the master tag if no sub-tag
 * is configured for that source.
 */
export function amazonAffiliateUrl(
  asin: string | null | undefined,
  tag?: string | null,
  source?: string | null
): string | null {
  if (!asin) return null;
  if (!/^[A-Z0-9]{10}$/.test(asin)) return null;
  return `https://www.amazon.com/dp/${asin}?tag=${encodeURIComponent(resolveAmazonTag(tag, source))}`;
}

/**
 * TikTok Shop affiliate URL. Uses the TIKTOK_SHOP_TAG env var as the affiliate
 * tag when present. We pass it through to the TikTok Shop product page using
 * TT's standard `aff` query param; if you have a different tracking scheme
 * configured in TikTok Affiliate Center, override `tag` directly.
 */
export function tiktokShopUrl(
  productId: string | null | undefined,
  tag?: string | null
): string | null {
  if (!productId) return null;
  const trimmed = productId.trim();
  if (!trimmed) return null;
  const affTag =
    tag ??
    (typeof process !== "undefined" ? process.env.TIKTOK_SHOP_TAG ?? null : null);
  const url = new URL(`https://shop.tiktok.com/view/product/${encodeURIComponent(trimmed)}`);
  if (affTag) url.searchParams.set("aff", affTag);
  return url.toString();
}

/**
 * Amazon search-results URL with affiliate tag. Compliant fallback for
 * products without a 1:1 ASIN match — Amazon's Operating Agreement allows
 * "related Product detail page or other relevant page", and a search-results
 * page for product-relevant keywords qualifies. The 24h affiliate cookie
 * credits any subsequent purchase.
 *
 * Pass curated `keywords` when available (3–6 short generic terms) for
 * better landing relevance than raw FB-Marketplace-style titles.
 */
export function amazonSearchUrl(
  query: string | null | undefined,
  tag?: string | null,
  source?: string | null
): string | null {
  const trimmed = query?.trim();
  if (!trimmed) return null;
  const params = new URLSearchParams({
    k: trimmed,
    tag: resolveAmazonTag(tag, source),
  });
  return `https://www.amazon.com/s?${params.toString()}`;
}

/**
 * Maps internal shop category slugs to the labels Facebook Marketplace
 * uses in its category dropdown. Used by the fb-draft-worker to pick
 * the right option when filling the create-listing form.
 */
export const FB_CATEGORY_MAP: Record<ShopCategory, string> = {
  Furniture: "Home & Garden",
  Electronics: "Electronics",
  Clothing: "Clothing & Accessories",
  Home: "Home & Garden",
  Kitchen: "Home & Garden",
  Kids: "Baby & Kids",
  Sports: "Sporting Goods",
  Tools: "Tools",
  Automotive: "Auto Parts",
  Toys: "Toys & Games",
  Books: "Books, Movies & Music",
  Other: "Home & Garden",
};

export function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

export function formatPrice(price: number): string {
  return price % 1 === 0 ? `$${price}` : `$${price.toFixed(2)}`;
}
