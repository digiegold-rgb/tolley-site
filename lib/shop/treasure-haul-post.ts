import { prisma } from "@/lib/prisma";
import { amazonAffiliateUrl } from "@/lib/shop";
import type { Product, PlatformListing, Prisma } from "@prisma/client";

const STOREFRONT_URL =
  process.env.AMAZON_STOREFRONT_URL || "https://www.amazon.com/shop/digitaljared";

const MAX_DESCRIPTION = 220;

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 1).trimEnd() + "…";
}

function pickPrice(
  product: Pick<Product, "targetPrice">,
  listings: Pick<PlatformListing, "price" | "platform" | "status">[]
): number | null {
  const shopListing = listings.find(
    (l) => l.platform === "shop" && l.status !== "removed"
  );
  if (shopListing?.price) return shopListing.price;
  const anyListing = listings.find((l) => l.price);
  if (anyListing?.price) return anyListing.price;
  return product.targetPrice ?? null;
}

function categoryHashtag(category: string | null | undefined): string | null {
  if (!category) return null;
  const slug = category
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 30);
  return slug ? `#${slug}` : null;
}

function buildShopLink(
  product: Pick<Product, "id" | "goSlug">,
  src: "fb" | "brand_fb" = "brand_fb",
): string {
  if (product.goSlug) return `https://www.tolley.io/go/${product.goSlug}?src=${src}`;
  return `https://www.tolley.io/shop/${product.id}?utm_source=facebook_brand_page&utm_medium=organic`;
}

export interface TreasureHaulCaptionInput {
  product: Pick<
    Product,
    "id" | "title" | "description" | "category" | "targetPrice" | "amazonAsin" | "goSlug" | "status"
  >;
  listings: Pick<PlatformListing, "price" | "platform" | "status">[];
}

export function formatTreasureHaulCaption(input: TreasureHaulCaptionInput): string {
  const { product, listings } = input;
  const price = pickPrice(product, listings);
  const isSold = product.status === "sold";

  const parts: string[] = [];
  parts.push(product.title.trim());

  if (product.description?.trim()) {
    parts.push("");
    parts.push(truncate(product.description.trim(), MAX_DESCRIPTION));
  }

  parts.push("");
  if (price && !isSold) {
    parts.push(`💰 $${price.toFixed(0)} — available now, Kansas City pickup or ships`);
  } else if (price && isSold) {
    parts.push(`💰 Sold for $${price.toFixed(0)} — but I find new ones daily!`);
  } else if (isSold) {
    parts.push("💰 Sold — but I find new ones daily!");
  } else {
    parts.push("💰 Available now — Kansas City pickup or ships");
  }

  parts.push(`🛒 Shop it: ${buildShopLink(product)}`);

  if (product.amazonAsin) {
    const amazon = amazonAffiliateUrl(product.amazonAsin, null, "brand_fb");
    if (amazon) parts.push(`🔗 Amazon: ${amazon}`);
  }
  parts.push(`🛍 Storefront: ${STOREFRONT_URL}?ref_=tolley_brand_fb`);

  parts.push("");
  const tags = ["#treasurehaul", "#thrifting", "#vintagefinds", "#kansascity"];
  const cat = categoryHashtag(product.category);
  if (cat) tags.push(cat);
  parts.push(tags.join(" "));

  return parts.join("\n");
}

export interface PickDailyOptions {
  excludeIds?: string[];
}

export async function pickDailyTreasureHaulProduct(
  opts: PickDailyOptions = {}
): Promise<
  | (Product & { listings: PlatformListing[] })
  | null
> {
  // Mirrors /shop's storefront filter: Product.status="listed" AND a shop
  // PlatformListing with status="active". This guarantees every posted item
  // is actually buyable on tolley.io/shop.
  const candidates = await prisma.product.findMany({
    where: {
      status: "listed",
      listings: { some: { platform: "shop", status: "active" } },
      id: opts.excludeIds?.length ? { notIn: opts.excludeIds } : undefined,
    },
    include: { listings: true },
    orderBy: [
      { syndicatedAt: { sort: "asc", nulls: "first" } },
      { createdAt: "asc" },
    ],
    take: 50,
  });

  for (const c of candidates) {
    if (!c.imageUrls || c.imageUrls.length === 0) continue;
    const hasPrice =
      c.targetPrice !== null ||
      c.listings.some((l) => l.price && l.status !== "removed");
    if (!hasPrice) continue;
    return c;
  }
  return null;
}

export function pickPrimaryImageUrl(product: Pick<Product, "imageUrls">): string | null {
  if (!product.imageUrls || product.imageUrls.length === 0) return null;
  const url = product.imageUrls[0];
  if (typeof url !== "string" || !url.trim()) return null;
  return url;
}

export interface TreasureHaulPostRecord {
  id: string;
  url: string;
  postedAt: string;
}

export function mergeTreasureHaulPostId(
  existing: unknown,
  record: TreasureHaulPostRecord
): Prisma.InputJsonValue {
  const base =
    existing && typeof existing === "object" && !Array.isArray(existing)
      ? (existing as Record<string, unknown>)
      : {};
  return { ...base, treasureHaulPage: { ...record } } as Prisma.InputJsonValue;
}

/**
 * Pick up to `limit` products newly listed in the last `sinceHours`.
 * Excludes products already posted to the brand Page within `cooldownHours`.
 * Used by the daily digest carousel.
 */
export async function pickRecentTreasureHaulProducts(
  limit: number,
  sinceHours: number = 48,
  cooldownHours: number = 168,
): Promise<(Product & { listings: PlatformListing[] })[]> {
  const since = new Date(Date.now() - sinceHours * 60 * 60 * 1000);
  const cooldown = new Date(Date.now() - cooldownHours * 60 * 60 * 1000);
  const candidates = await prisma.product.findMany({
    where: {
      status: "listed",
      listings: { some: { platform: "shop", status: "active" } },
      createdAt: { gte: since },
      OR: [
        { syndicatedAt: null },
        { syndicatedAt: { lt: cooldown } },
      ],
    },
    include: { listings: true },
    orderBy: { createdAt: "desc" },
    take: limit * 4,
  });
  return filterPostable(candidates).slice(0, limit);
}

/**
 * Pick `limit` active products to top up the daily digest when fewer than
 * `limit` items were uploaded in the last 48 hr (the common case — Ruthann
 * uploads in batches on Fridays). Pulls from the backlog of products whose
 * brand-Page `syndicatedAt` is null or older than `cooldownDays`, ordered
 * "longest unfeatured first" so every active item rotates through the Page.
 *
 * `excludeIds` lets the daily cron skip items already in the newest batch.
 */
export async function pickBackfillTreasureHaulProducts(
  limit: number,
  cooldownDays: number = 30,
  excludeIds: string[] = [],
): Promise<(Product & { listings: PlatformListing[] })[]> {
  if (limit <= 0) return [];
  const cooldown = new Date(Date.now() - cooldownDays * 24 * 60 * 60 * 1000);
  const candidates = await prisma.product.findMany({
    where: {
      status: "listed",
      listings: { some: { platform: "shop", status: "active" } },
      ...(excludeIds.length > 0 ? { id: { notIn: excludeIds } } : {}),
      OR: [
        { syndicatedAt: null },
        { syndicatedAt: { lt: cooldown } },
      ],
    },
    include: { listings: true },
    // Nulls-first via Prisma: order by syndicatedAt asc — Postgres places NULL last
    // by default, so we use a two-pass: pull a wider net then re-sort in JS.
    orderBy: [{ syndicatedAt: "asc" }, { createdAt: "asc" }],
    take: limit * 8,
  });
  const sorted = [...candidates].sort((a, b) => {
    const aT = a.syndicatedAt ? a.syndicatedAt.getTime() : 0;
    const bT = b.syndicatedAt ? b.syndicatedAt.getTime() : 0;
    return aT - bT; // never-posted (0) first, then oldest-posted next
  });
  return filterPostable(sorted).slice(0, limit);
}

/**
 * Pick top products by Page-attributable engagement over the last `windowDays`.
 * Used by the Saturday weekly highlight.
 */
export async function pickWeeklyTopProducts(
  limit: number,
  windowDays: number = 7,
): Promise<(Product & { listings: PlatformListing[] })[]> {
  const _since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
  void _since;
  // Engagement signal: prefer goClicksFacebook, then goClicksDirect, then amazonClicks.
  // We don't have time-windowed click tables; counters are lifetime, so we
  // pull active products ordered by composite click score and return the top N.
  const candidates = await prisma.product.findMany({
    where: {
      status: "listed",
      listings: { some: { platform: "shop", status: "active" } },
    },
    include: { listings: true },
    orderBy: [
      { goClicksFacebook: "desc" },
      { goClicksDirect: "desc" },
      { amazonClicks: "desc" },
    ],
    take: limit * 4,
  });
  return filterPostable(candidates).slice(0, limit);
}

/**
 * Pick Amazon-affiliated products for the Sunday "Amazon picks" post.
 * Requires `amazonAsin` set; ordered by amazonClicks desc, then asinMatchedAt.
 */
export async function pickAmazonPickProducts(
  limit: number,
): Promise<(Product & { listings: PlatformListing[] })[]> {
  const candidates = await prisma.product.findMany({
    where: {
      amazonAsin: { not: null },
      OR: [
        { status: "listed" },
        { status: "sold" }, // sold-out items still earn affiliate revenue when redirected to Amazon
      ],
    },
    include: { listings: true },
    orderBy: [
      { amazonClicks: "desc" },
      { asinMatchedAt: "desc" },
    ],
    take: limit * 4,
  });
  // Don't require an active shop listing — Amazon picks can include sold inventory.
  return candidates
    .filter((c) => c.imageUrls && c.imageUrls.length > 0 && c.amazonAsin)
    .slice(0, limit);
}

function filterPostable(
  candidates: (Product & { listings: PlatformListing[] })[],
): (Product & { listings: PlatformListing[] })[] {
  return candidates.filter((c) => {
    if (!c.imageUrls || c.imageUrls.length === 0) return false;
    const hasPrice =
      c.targetPrice !== null ||
      c.listings.some((l) => l.price && l.status !== "removed");
    return hasPrice;
  });
}

/**
 * Caption for a multi-product carousel (digest or weekly highlight).
 * Returns the primary post body. Use `buildBrandPageGoComment` for the
 * first-comment outbound link.
 */
export function formatTreasureHaulCarouselCaption(opts: {
  variant: "digest" | "rotation" | "weekly_highlight";
  products: TreasureHaulCaptionInput["product"][];
}): string {
  const { variant, products } = opts;
  const intro =
    variant === "digest"
      ? `🪄 Fresh finds at the haul today — ${products.length} new ${products.length === 1 ? "treasure" : "treasures"} just dropped:`
      : variant === "rotation"
        ? `🪄 Today's haul — ${products.length} ${products.length === 1 ? "piece" : "pieces"} from the shelves:`
        : `✨ Most-loved finds this week — top ${products.length} based on clicks + DMs:`;

  const lines: string[] = [intro, ""];
  for (const p of products) {
    const t = p.title.trim();
    lines.push(`• ${t}`);
  }
  lines.push("");
  lines.push("🛒 Shop the haul → https://www.tolley.io/shop?utm_source=facebook_brand_page&utm_medium=organic");
  lines.push("Local pickup in Kansas City · ships nationwide");
  lines.push("");
  lines.push("#treasurehaul #thrifting #vintagefinds #kansascity");
  return lines.join("\n");
}

/**
 * First-comment text for digest/weekly posts — outbound /go link to /shop.
 * FB algorithm down-ranks outbound links in post body, ignores them in comments.
 */
export function buildBrandPageGoComment(): string {
  return [
    "🛒 Shop the haul → https://www.tolley.io/shop?utm_source=facebook_brand_page&utm_medium=organic",
    "",
    "(every item below has its own page — click any photo to read the full story, see all photos, and hit Buy Now or message Ruthann for pickup details)",
  ].join("\n");
}

/**
 * Caption for the Sunday Amazon picks post. Highlights the influencer
 * storefront. Required FTC affiliate disclosure included.
 */
export function formatAmazonPicksCaption(
  products: TreasureHaulCaptionInput["product"][],
): string {
  const lines: string[] = [];
  lines.push("🛍 This week's Amazon picks — handpicked by Ruthann:");
  lines.push("");
  for (const p of products) {
    lines.push(`• ${p.title.trim()}`);
  }
  lines.push("");
  lines.push("Full storefront → https://www.amazon.com/shop/digitaljared?ref_=tolley_brand_fb");
  lines.push("");
  lines.push("As an Amazon Associate I earn from qualifying purchases. Same Prime shipping you already love. 🛒");
  lines.push("");
  lines.push("#amazonfinds #amazonstorefront #treasurehaul #amazonassociate");
  return lines.join("\n");
}

/**
 * First-comment for Amazon-picks post: list each product's affiliate URL,
 * one per line, so click attribution lands on `tolley-brand-fb-20`.
 */
export function buildAmazonPicksGoComment(
  products: TreasureHaulCaptionInput["product"][],
): string {
  const lines: string[] = ["🔗 Direct links (Amazon affiliate):"];
  for (const p of products) {
    if (!p.amazonAsin) continue;
    const url = amazonAffiliateUrl(p.amazonAsin, null, "brand_fb");
    if (!url) continue;
    lines.push(`${p.title.trim()}: ${url}`);
  }
  return lines.join("\n");
}

export async function alertDiscord(message: string): Promise<void> {
  const url =
    process.env.DISCORD_FB_ALERT_WEBHOOK || process.env.DISCORD_PRIVACY_WEBHOOK;
  if (!url) {
    console.warn(
      "[treasure-haul] No Discord webhook configured (DISCORD_FB_ALERT_WEBHOOK / DISCORD_PRIVACY_WEBHOOK), skipping alert:",
      message
    );
    return;
  }
  try {
    await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content: `🪄 Treasure Haul: ${message}` }),
      signal: AbortSignal.timeout(5_000),
    });
  } catch (err) {
    console.error("[treasure-haul] Discord alert failed:", err);
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Amazon Haul (sub-$20, $4 first-purchase bounty)
//
// Haul-eligible products are flagged nightly by `/api/cron/haul-flag`. The
// `/api/cron/haul-promote` cron picks 3 oldest-promoted rows and fans them
// out via the same FB/IG/Pin pattern as the Sunday picks cycle, but with
// Haul-specific captions that lean on the $4 first-purchase bounty hook.
// ────────────────────────────────────────────────────────────────────────────

const HAUL_LIMIT_USD = 20;

export async function pickHaulProducts(
  limit: number,
): Promise<(Product & { listings: PlatformListing[] })[]> {
  const candidates = await prisma.product.findMany({
    where: {
      haulEligible: true,
      amazonAsin: { not: null },
    },
    include: { listings: true },
    // Round-robin: oldest-promoted first so every Haul item rotates through.
    orderBy: [
      { haulPromotedAt: { sort: "asc", nulls: "first" } },
      { amazonClicks: "desc" },
    ],
    take: limit * 3,
  });
  return candidates
    .filter((c) => c.imageUrls && c.imageUrls.length > 0 && c.amazonAsin)
    .slice(0, limit);
}

export function formatHaulFacebookCaption(
  products: TreasureHaulCaptionInput["product"][],
): string {
  const lines: string[] = [];
  lines.push(
    `🛒 Amazon Haul — every pick under $${HAUL_LIMIT_USD}, hand-picked by Ruthann:`,
  );
  lines.push("");
  for (const p of products) {
    lines.push(`• ${p.title.trim()}`);
  }
  lines.push("");
  lines.push(`Full Haul storefront → ${STOREFRONT_URL}?ref_=tolley_haul_fb`);
  lines.push("");
  lines.push(
    "As an Amazon Associate I earn from qualifying purchases — and Amazon may award a one-time first-purchase bounty on Haul orders. Prime shipping. 🛒",
  );
  lines.push("");
  lines.push("#amazonhaul #amazonfinds #under20 #treasurehaul #amazonassociate");
  return lines.join("\n");
}

export function formatHaulInstagramCaption(
  items: { title: string; asin: string | null }[],
): string {
  const lines: string[] = [];
  lines.push(`🛒 Amazon Haul — everything under $${HAUL_LIMIT_USD}`);
  lines.push("");
  for (const item of items) lines.push(`✨ ${item.title.trim()}`);
  lines.push("");
  lines.push(`Shop the Haul → amazon.com/shop/digitaljared`);
  lines.push("More finds at tolley.io/shop (link in bio)");
  lines.push("");
  lines.push("As an Amazon Associate I earn from qualifying purchases.");
  lines.push("");
  lines.push(
    "#amazonhaul #under20 #amazonfinds #amazonstorefront #treasurehaul #amazonassociate",
  );
  return lines.join("\n");
}

export function buildHaulPinterestDescription(
  p: Pick<Product, "title" | "description">,
): string {
  const lines: string[] = [];
  lines.push(`${p.title.trim()} — under $${HAUL_LIMIT_USD} on Amazon Haul`);
  if (p.description?.trim()) {
    lines.push("");
    lines.push(p.description.trim().slice(0, 320));
  }
  lines.push("");
  lines.push(`Full Haul storefront → amazon.com/shop/digitaljared`);
  lines.push("");
  lines.push("As an Amazon Associate I earn from qualifying purchases.");
  lines.push("#amazonhaul #under20 #amazonfinds #treasurehaul");
  return lines.join("\n").slice(0, 800);
}

export function buildHaulPicksGoComment(
  products: TreasureHaulCaptionInput["product"][],
): string {
  const lines: string[] = ["🔗 Direct Haul links (Amazon affiliate):"];
  for (const p of products) {
    if (!p.amazonAsin) continue;
    const url = `https://www.amazon.com/dp/${p.amazonAsin}?tag=${encodeURIComponent(
      process.env.AMAZON_HAUL_TAG || process.env.AMAZON_AFFILIATE_TAG || "tolley-shop-20",
    )}`;
    lines.push(`• ${p.title.trim().slice(0, 70)} → ${url}`);
  }
  lines.push("");
  lines.push("(Every item under $20. Amazon may award a $4 first-purchase bounty.)");
  return lines.join("\n");
}
