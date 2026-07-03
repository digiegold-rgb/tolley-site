/**
 * Per-channel Amazon Associates tracking IDs.
 *
 * Amazon lets you create up to 100 sub-tags under your master Associates
 * account at affiliate-program.amazon.com → Account Settings → Manage Tracking
 * IDs. We use one per traffic source so we can attribute earnings back to
 * the platform that generated the click (TikTok vs YouTube vs our own /shop).
 *
 * Configure via the AMAZON_SUBTAGS_JSON env var, e.g.:
 *   AMAZON_SUBTAGS_JSON='{"tt":"tolley-tt-20","yt":"tolley-yt-20",...}'
 *
 * If unset (or unparseable), we fall back to the master tag for every source.
 * That's the safe behavior — we just lose per-channel granularity until the
 * sub-tags are registered.
 */

// Duplicated locally so this file has no circular dep on lib/shop.ts.
// Keep in sync if the master tag ever changes.
const AMAZON_AFFILIATE_TAG_FALLBACK = "tolley-shop-20";

export type AmazonSubtagSource =
  | "tt"
  | "tiktok"
  | "yt"
  | "youtube"
  | "ig"
  | "instagram"
  | "fb"
  | "facebook"
  | "brand_fb"
  | "gbp"
  | "google_maps"
  | "pin"
  | "pinterest"
  | "shop"
  | "bounty"
  | "haul"
  | "sms"
  | "direct";

// `brand_fb` distinguishes Ruthann's Treasure Haul brand Page traffic from
// `fb` (which captures personal-profile + Marketplace deep-links). `gbp`
// captures Google Business Profile / Maps traffic. `sms` is the opted-in
// WhatsApp/SMS past-buyer broadcast channel (added 2026-07-02 for the
// Amazon 3-sales push) — falls back to the master tag until tolley-sms-20
// is registered in Associates Central and added to AMAZON_SUBTAGS_JSON.
const SOURCE_CANONICAL: Record<string, string> = {
  tt: "tt",
  tiktok: "tt",
  yt: "yt",
  youtube: "yt",
  ig: "ig",
  instagram: "ig",
  fb: "fb",
  facebook: "fb",
  brand_fb: "brand_fb",
  brand_facebook: "brand_fb",
  facebook_brand_page: "brand_fb",
  treasure_haul: "brand_fb",
  gbp: "gbp",
  google_maps: "gbp",
  google_business: "gbp",
  pin: "pin",
  pinterest: "pin",
  shop: "shop",
  bounty: "bounty",
  haul: "haul",
  amazon_haul: "haul",
  sms: "sms",
  whatsapp: "sms",
  direct: "direct",
};

let cached: { tags: Record<string, string>; raw: string | null } | null = null;

function loadSubtags(): Record<string, string> {
  const raw =
    typeof process !== "undefined" ? process.env.AMAZON_SUBTAGS_JSON ?? null : null;
  if (cached && cached.raw === raw) return cached.tags;
  let tags: Record<string, string> = {};
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        for (const [k, v] of Object.entries(parsed)) {
          if (typeof v === "string" && v.trim()) {
            tags[k.toLowerCase()] = v.trim();
          }
        }
      }
    } catch {
      // bad JSON — silently fall back to master tag
    }
  }
  cached = { tags, raw };
  return tags;
}

// DB-backed override layer. Rows in `AmazonSubtag` with `verified = true`
// take precedence over the env JSON. Refreshed every 60 s on first redirect
// so admin changes propagate without a redeploy.
let dbCache: { tags: Record<string, string>; loadedAt: number } | null = null;
let dbInFlight: Promise<Record<string, string>> | null = null;
const DB_TTL = 60_000;

async function loadDbSubtags(): Promise<Record<string, string>> {
  // Lazy import to keep this module usable in environments without prisma
  // (e.g. caption builders running inside the Vater pipeline).
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { prisma } = require("@/lib/prisma") as typeof import("@/lib/prisma");
  const rows = await prisma.amazonSubtag.findMany({
    where: { verified: true },
  });
  const out: Record<string, string> = {};
  for (const r of rows) {
    if (r.tagId.trim()) out[r.source.toLowerCase()] = r.tagId.trim();
  }
  return out;
}

export async function ensureSubtagsLoaded(): Promise<void> {
  if (dbCache && Date.now() - dbCache.loadedAt < DB_TTL) return;
  if (dbInFlight) {
    await dbInFlight;
    return;
  }
  dbInFlight = loadDbSubtags()
    .then((tags) => {
      dbCache = { tags, loadedAt: Date.now() };
      return tags;
    })
    .catch(() => {
      // DB unreachable — keep stale cache (or fall back to env-only via empty map)
      if (!dbCache) dbCache = { tags: {}, loadedAt: Date.now() };
      return dbCache.tags;
    })
    .finally(() => {
      dbInFlight = null;
    });
  await dbInFlight;
}

function masterTag(fallback: string): string {
  if (typeof process !== "undefined" && process.env.AMAZON_AFFILIATE_TAG) {
    return process.env.AMAZON_AFFILIATE_TAG;
  }
  return fallback;
}

export function resolveAmazonSubtag(
  source: string | null | undefined,
  fallback: string = AMAZON_AFFILIATE_TAG_FALLBACK
): string {
  const master = masterTag(fallback);
  if (!source) return master;
  const canonical = SOURCE_CANONICAL[source.toLowerCase()];
  if (!canonical) return master;
  const dbTag = dbCache?.tags[canonical];
  if (dbTag) return dbTag;
  const tags = loadSubtags();
  return tags[canonical] || master;
}

export const SUBTAG_CANONICAL_SOURCES: { source: string; description: string }[] = [
  { source: "tt", description: "TikTok bio + comment links" },
  { source: "yt", description: "YouTube descriptions + cards" },
  { source: "ig", description: "Instagram Story + bio" },
  { source: "fb", description: "Facebook Marketplace + personal profile" },
  { source: "brand_fb", description: "Ruthann's Treasure Haul brand Page" },
  { source: "pin", description: "Pinterest pins" },
  { source: "gbp", description: "Google Business Profile / Maps" },
  { source: "shop", description: "tolley.io/shop on-site Buy on Amazon" },
  { source: "bounty", description: "Amazon Bounty (Prime / Audible / KU)" },
  { source: "haul", description: "Amazon Haul $4 first-purchase bounty (sub-$20 products)" },
  { source: "direct", description: "Type-in / unknown referrer" },
];

/**
 * Amazon Haul affiliate URL. Same `?tag=` mechanic as a standard product
 * link — Amazon awards the $4 first-purchase bounty automatically when the
 * landed item is Haul-eligible, regardless of which Tracking ID is used.
 * Using a `haul` subtag isolates Haul attribution for reporting.
 *
 * Falls back to the master tag when `tolley-haul-20` isn't registered yet.
 */
export function amazonHaulUrl(
  asin: string | null | undefined,
  source: string = "haul"
): string | null {
  if (!asin) return null;
  if (!/^[A-Z0-9]{10}$/.test(asin)) return null;
  return `https://www.amazon.com/dp/${asin}?tag=${encodeURIComponent(resolveAmazonSubtag(source))}`;
}
