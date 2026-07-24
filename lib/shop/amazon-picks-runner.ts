/**
 * Shared Amazon-picks cycle. Originally a Sunday-only FB carousel; now drives
 * a Sun/Tue/Fri rotation that fans out to Facebook, Instagram, and Pinterest.
 * Each platform uses its own canonical Amazon Associates subtag (brand_fb /
 * ig / pin) so attribution lands in the right Tracking ID once subtags are
 * registered (see `/shop/dashboard/amazon-subtags`). Until they're registered,
 * everything safely falls back to the master tag.
 */

import {
  FB_PAGES,
  TREASURE_HAUL_PAGE_ID,
  commentOnPost,
  getPageToken,
  publishCarouselToPage,
} from "@/lib/facebook";
import {
  buildAmazonPicksGoComment,
  buildHaulPicksGoComment,
  buildHaulPinterestDescription,
  formatAmazonPicksCaption,
  formatHaulFacebookCaption,
  formatHaulInstagramCaption,
  mergeAmazonPicksStamp,
  pickAmazonPickProducts,
  pickHaulProducts,
  pickPrimaryImageUrl,
  alertDiscord,
} from "@/lib/shop/treasure-haul-post";
import { amazonAffiliateUrl } from "@/lib/shop";
import { getStoredToken } from "@/lib/social/token-store";
import { prisma } from "@/lib/prisma";
import type { Product, PlatformListing } from "@prisma/client";

const FB_API = "https://graph.facebook.com";
const FB_VER = process.env.FACEBOOK_API_VERSION || "v18.0";
const PIN_API = "https://api.pinterest.com/v5";

type Platform = "facebook" | "instagram" | "pinterest";

interface PlatformResult {
  platform: Platform;
  ok: boolean;
  postedCount?: number;
  postUrl?: string;
  error?: string;
  skipped?: string;
}

export interface RunResult {
  ok: boolean;
  productsConsidered: number;
  results: PlatformResult[];
  pickedProducts: { id: string; title: string; asin: string | null }[];
}

const PICK_COUNT = 3;

export type CycleMode = "picks" | "haul";

export async function runAmazonPicksCycle(opts: {
  platforms: Platform[];
  mode?: CycleMode;
}): Promise<RunResult> {
  const mode: CycleMode = opts.mode ?? "picks";
  const platforms = Array.from(new Set(opts.platforms));
  const products =
    mode === "haul"
      ? await pickHaulProducts(PICK_COUNT)
      : await pickAmazonPickProducts(PICK_COUNT);

  if (products.length === 0) {
    return {
      ok: true,
      productsConsidered: 0,
      results: platforms.map((p) => ({
        platform: p,
        ok: true,
        skipped:
          mode === "haul"
            ? "no haul-eligible products with images"
            : "no Amazon-affiliated products with images",
      })),
      pickedProducts: [],
    };
  }

  const results: PlatformResult[] = [];
  for (const platform of platforms) {
    try {
      if (platform === "facebook") {
        results.push(await postFacebook(products, mode));
      } else if (platform === "instagram") {
        results.push(await postInstagram(products, mode));
      } else if (platform === "pinterest") {
        results.push(await postPinterest(products, mode));
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "unknown error";
      results.push({ platform, ok: false, error: msg });
      await alertDiscord(`${mode === "haul" ? "amazon-haul" : "amazon-picks"} ${platform} failed: ${msg}`);
    }
  }

  // Stamp haulPromotedAt on success so the round-robin picker rotates.
  if (mode === "haul" && results.some((r) => r.ok && !r.skipped)) {
    const promotedIds = products.map((p) => p.id);
    await prisma.product.updateMany({
      where: { id: { in: promotedIds } },
      data: { haulPromotedAt: new Date() },
    });
  }

  // Same rotation stamp for picks mode — stored in postizPostIds JSON
  // (per-product merge, so no schema migration) and read back by
  // pickAmazonPickProducts' 30-day cooldown.
  if (mode === "picks" && results.some((r) => r.ok && !r.skipped)) {
    const promotedAt = new Date();
    await Promise.all(
      products.map((p) =>
        prisma.product
          .update({
            where: { id: p.id },
            data: { postizPostIds: mergeAmazonPicksStamp(p.postizPostIds, promotedAt) },
          })
          .catch(() => {}),
      ),
    );
  }

  return {
    ok: results.every((r) => r.ok),
    productsConsidered: products.length,
    results,
    pickedProducts: products.map((p) => ({
      id: p.id,
      title: p.title,
      asin: p.amazonAsin,
    })),
  };
}

// ── Facebook (existing carousel + first-comment) ─────────────────────

async function postFacebook(
  products: (Product & { listings: PlatformListing[] })[],
  mode: CycleMode,
): Promise<PlatformResult> {
  const page = FB_PAGES.find((p) => p.id === TREASURE_HAUL_PAGE_ID);
  if (!page) return { platform: "facebook", ok: false, error: "Treasure Haul page not configured" };
  const token = getPageToken(page);
  if (!token) return { platform: "facebook", ok: false, error: `${page.tokenEnvKey} not set` };

  const items = products
    .map((p) => {
      const url = pickPrimaryImageUrl(p);
      return url ? { imageUrl: url, altCaption: p.title } : null;
    })
    .filter((x): x is { imageUrl: string; altCaption: string } => x !== null);

  if (items.length === 0) return { platform: "facebook", ok: true, skipped: "no usable images" };

  const caption =
    mode === "haul"
      ? formatHaulFacebookCaption(products)
      : formatAmazonPicksCaption(products);
  const goComment =
    mode === "haul"
      ? buildHaulPicksGoComment(products)
      : buildAmazonPicksGoComment(products);

  const result = await publishCarouselToPage(page.id, token, items, caption);

  await commentOnPost(result.id, token, goComment).catch((err) => {
    console.warn(`[${mode === "haul" ? "amazon-haul" : "amazon-picks"}] FB first-comment failed (non-fatal):`, err);
  });

  return { platform: "facebook", ok: true, postedCount: 1, postUrl: result.postUrl };
}

// ── Instagram carousel via Graph API ─────────────────────────────────

async function postInstagram(
  products: (Product & { listings: PlatformListing[] })[],
  mode: CycleMode,
): Promise<PlatformResult> {
  // Prefer the token the Facebook/Instagram OAuth callback saved to the DB
  // (saveStoredToken("instagram", { accountId: <IG business id>, ... })) so a
  // single re-auth click wires both the token AND the business id — no env
  // paste, no redeploy. Fall back to env for older manual setups.
  const stored = await getStoredToken("instagram");
  const igUserId = stored?.accountId || process.env.INSTAGRAM_BUSINESS_ID;
  const token =
    stored?.accessToken ||
    process.env.INSTAGRAM_PAGE_TOKEN ||
    process.env.FACEBOOK_PAGE_TOKEN_TREASURE ||
    process.env.FACEBOOK_PAGE_TOKEN_MAIN;

  if (!igUserId || !token) {
    return {
      platform: "instagram",
      ok: false,
      error:
        "Instagram not connected — run the Facebook/Instagram re-auth (tolley.io/api/social/oauth/facebook/start) with the IG account selected",
    };
  }

  const items = products
    .map((p) => ({ url: pickPrimaryImageUrl(p), title: p.title, asin: p.amazonAsin }))
    .filter((x): x is { url: string; title: string; asin: string | null } =>
      x.url !== null,
    );

  if (items.length === 0) return { platform: "instagram", ok: true, skipped: "no usable images" };

  // 1. Create one carousel-item container per image (max 10; we only have 3).
  const childIds: string[] = [];
  for (const item of items) {
    const params = new URLSearchParams({
      image_url: item.url,
      is_carousel_item: "true",
      access_token: token,
    });
    const res = await fetch(`${FB_API}/${FB_VER}/${igUserId}/media`, {
      method: "POST",
      body: params,
    });
    if (!res.ok) {
      const text = await res.text();
      return {
        platform: "instagram",
        ok: false,
        error: `IG carousel-child ${res.status}: ${text.slice(0, 200)}`,
      };
    }
    const { id } = (await res.json()) as { id: string };
    childIds.push(id);
  }

  // 2. Create the parent carousel container. IG ignores outbound links in
  //    captions, so we point readers at "link in bio" — the bio links to
  //    /shop, which routes them through /go to Amazon with the ig subtag.
  const caption =
    mode === "haul"
      ? formatHaulInstagramCaption(items)
      : formatInstagramCaption(items);
  const parentParams = new URLSearchParams({
    media_type: "CAROUSEL",
    children: childIds.join(","),
    caption,
    access_token: token,
  });
  const parentRes = await fetch(`${FB_API}/${FB_VER}/${igUserId}/media`, {
    method: "POST",
    body: parentParams,
  });
  if (!parentRes.ok) {
    const text = await parentRes.text();
    return {
      platform: "instagram",
      ok: false,
      error: `IG carousel-parent ${parentRes.status}: ${text.slice(0, 200)}`,
    };
  }
  const { id: parentId } = (await parentRes.json()) as { id: string };

  // 3. Publish.
  const publishRes = await fetch(`${FB_API}/${FB_VER}/${igUserId}/media_publish`, {
    method: "POST",
    body: new URLSearchParams({ creation_id: parentId, access_token: token }),
  });
  if (!publishRes.ok) {
    const text = await publishRes.text();
    return {
      platform: "instagram",
      ok: false,
      error: `IG publish ${publishRes.status}: ${text.slice(0, 200)}`,
    };
  }
  const { id: mediaId } = (await publishRes.json()) as { id: string };
  return {
    platform: "instagram",
    ok: true,
    postedCount: 1,
    postUrl: `https://www.instagram.com/p/${mediaId}/`,
  };
}

function formatInstagramCaption(
  items: { title: string; asin: string | null }[],
): string {
  const lines: string[] = [];
  lines.push("🛍 This week's Amazon picks — handpicked by Ruthann");
  lines.push("");
  for (const item of items) lines.push(`✨ ${item.title.trim()}`);
  lines.push("");
  lines.push("Shop the full storefront → amazon.com/shop/digitaljared");
  lines.push("More finds at tolley.io/shop (link in bio)");
  lines.push("");
  lines.push("As an Amazon Associate I earn from qualifying purchases.");
  lines.push("");
  lines.push(
    "#amazonfinds #amazonstorefront #treasurehaul #amazonassociate #kansascity",
  );
  return lines.join("\n");
}

// ── Pinterest: one pin per pick, link straight to Amazon ─────────────

async function postPinterest(
  products: (Product & { listings: PlatformListing[] })[],
  mode: CycleMode,
): Promise<PlatformResult> {
  // The Pinterest OAuth callback saves the access token to the DB store
  // (platform="pinterest", accountId=<default board id>), so a single connect
  // click wires everything with no env paste. Fall back to env.
  const stored = await getStoredToken("pinterest");
  const token = stored?.accessToken || process.env.PINTEREST_ACCESS_TOKEN;
  const boardId = stored?.accountId || process.env.PINTEREST_DEFAULT_BOARD;
  if (!token || !boardId) {
    return {
      platform: "pinterest",
      ok: false,
      error: "Pinterest not connected (PINTEREST_ACCESS_TOKEN + PINTEREST_DEFAULT_BOARD)",
    };
  }

  let posted = 0;
  const errors: string[] = [];
  for (const p of products) {
    const imageUrl = pickPrimaryImageUrl(p);
    if (!imageUrl || !p.amazonAsin) continue;
    const dest = amazonAffiliateUrl(p.amazonAsin, null, mode === "haul" ? "haul" : "pin");
    if (!dest) continue;

    const description =
      mode === "haul" ? buildHaulPinterestDescription(p) : buildPinterestDescription(p);

    const res = await fetch(`${PIN_API}/pins`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        board_id: boardId,
        title: p.title.slice(0, 100),
        description,
        link: dest,
        media_source: { source_type: "image_url", url: imageUrl },
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      errors.push(`${p.id}: ${res.status} ${text.slice(0, 120)}`);
      continue;
    }
    posted += 1;
  }

  if (posted === 0) {
    return {
      platform: "pinterest",
      ok: false,
      error: errors.length ? errors.join(" | ") : "no eligible products",
    };
  }
  return { platform: "pinterest", ok: true, postedCount: posted };
}

function buildPinterestDescription(p: Pick<Product, "title" | "description">): string {
  const lines: string[] = [];
  lines.push(p.title.trim());
  if (p.description?.trim()) {
    lines.push("");
    lines.push(p.description.trim().slice(0, 350));
  }
  lines.push("");
  lines.push("Full storefront → amazon.com/shop/digitaljared");
  lines.push("");
  lines.push("As an Amazon Associate I earn from qualifying purchases.");
  lines.push("#amazonfinds #treasurehaul #thrifting #vintagefinds");
  return lines.join("\n").slice(0, 800);
}
