import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  FB_PAGES,
  TREASURE_HAUL_PAGE_ID,
  commentOnPost,
  getPageToken,
  publishCarouselToPage,
  publishToPage,
} from "@/lib/facebook";
import {
  buildBrandPageGoComment,
  formatTreasureHaulCaption,
  formatTreasureHaulCarouselCaption,
  pickBackfillTreasureHaulProducts,
  pickDailyTreasureHaulProduct,
  pickPrimaryImageUrl,
  pickRecentTreasureHaulProducts,
  mergeTreasureHaulPostId,
  alertDiscord,
} from "@/lib/shop/treasure-haul-post";
import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";

export const runtime = "nodejs";
export const maxDuration = 60;

const DIGEST_MIN_ITEMS = 3;
const DIGEST_TARGET_ITEMS = 4;
const DIGEST_MAX_ITEMS = 5;
// Days an item must wait after a brand-Page feature before backfill picks it again.
const BACKFILL_COOLDOWN_DAYS = 30;

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get("authorization");
  if (!header) return false;
  return header === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const page = FB_PAGES.find((p) => p.id === TREASURE_HAUL_PAGE_ID);
  if (!page) {
    return NextResponse.json(
      { ok: false, error: "Treasure Haul page not configured" },
      { status: 500 }
    );
  }
  const token = getPageToken(page);
  if (!token) {
    await alertDiscord(`daily cron failed: ${page.tokenEnvKey} not set`);
    return NextResponse.json(
      { ok: false, error: `${page.tokenEnvKey} not set` },
      { status: 503 }
    );
  }

  // Strategy: aim for a 4-item carousel every day.
  //   1. Pull up to 5 newest items from the last 48 hr (Friday's drop).
  //   2. If we have fewer than 4, top up from the active backlog —
  //      products that haven't been featured on the brand Page in 30+ days
  //      (or never), oldest-unfeatured first so every item rotates through.
  //   3. Only fall back to single-product mode if the whole catalog has been
  //      exhausted (truly nothing to post).
  const recent = await pickRecentTreasureHaulProducts(DIGEST_MAX_ITEMS, 48);
  const need = Math.max(0, DIGEST_TARGET_ITEMS - recent.length);
  const backfill = need > 0
    ? await pickBackfillTreasureHaulProducts(
        need,
        BACKFILL_COOLDOWN_DAYS,
        recent.map((p) => p.id),
      )
    : [];
  const products = [...recent, ...backfill].slice(0, DIGEST_MAX_ITEMS);
  // "digest" only when every item is genuinely fresh (last 48 hr).
  // Mix or pure backlog → "rotation" so the caption stays honest.
  const variant: "digest" | "rotation" =
    backfill.length === 0 && recent.length > 0 ? "digest" : "rotation";

  if (products.length >= DIGEST_MIN_ITEMS) {
    return postDigest(page.id, token, products, variant);
  }
  return postSingle(page.id, token);
}

async function postDigest(
  pageId: string,
  token: string,
  products: Awaited<ReturnType<typeof pickRecentTreasureHaulProducts>>,
  variant: "digest" | "rotation" = "digest",
) {
  const items = products
    .map((p) => {
      const url = pickPrimaryImageUrl(p);
      return url ? { imageUrl: url, altCaption: p.title } : null;
    })
    .filter((x): x is { imageUrl: string; altCaption: string } => x !== null);

  if (items.length < DIGEST_MIN_ITEMS) {
    return postSingle(pageId, token);
  }

  const caption = formatTreasureHaulCarouselCaption({
    variant,
    products,
  });

  let result;
  try {
    result = await publishCarouselToPage(pageId, token, items, caption);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "publishCarouselToPage failed";
    await alertDiscord(`daily digest cron failed: ${msg}`);
    return NextResponse.json({ ok: false, error: msg, mode: "digest" }, { status: 502 });
  }

  // First-comment goLink — separate API call, best effort
  try {
    await commentOnPost(result.id, token, buildBrandPageGoComment());
  } catch (err) {
    console.warn("[treasure-haul] digest first-comment failed (non-fatal):", err);
  }

  const postedAt = new Date();
  await Promise.all(
    products.map((p) => {
      const merged = mergeTreasureHaulPostId(p.postizPostIds, {
        id: result.id,
        url: result.postUrl,
        postedAt: postedAt.toISOString(),
      });
      return prisma.product.update({
        where: { id: p.id },
        data: {
          syndicatedAt: postedAt,
          postizPostIds: merged as Prisma.InputJsonValue,
        },
      });
    }),
  );
  revalidatePath("/shop");

  return NextResponse.json({
    ok: true,
    mode: variant,
    products: products.map((p) => ({ id: p.id, title: p.title })),
    postId: result.id,
    url: result.postUrl,
  });
}

async function postSingle(pageId: string, token: string) {
  const product = await pickDailyTreasureHaulProduct();
  if (!product) {
    return NextResponse.json({
      ok: true,
      mode: "single",
      skipped: "no eligible product (need active + images + price)",
    });
  }

  const imageUrl = pickPrimaryImageUrl(product);
  if (!imageUrl) {
    return NextResponse.json({
      ok: true,
      mode: "single",
      skipped: "selected product has no usable image",
      productId: product.id,
    });
  }

  const caption = formatTreasureHaulCaption({ product, listings: product.listings });

  let result: { id: string; postUrl: string };
  try {
    result = await publishToPage(pageId, token, {
      message: caption,
      imageUrl,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "publishToPage failed";
    await alertDiscord(`daily cron failed for ${product.id} (${product.title}): ${msg}`);
    return NextResponse.json({ ok: false, error: msg, mode: "single" }, { status: 502 });
  }

  const postedAt = new Date();
  const merged = mergeTreasureHaulPostId(product.postizPostIds, {
    id: result.id,
    url: result.postUrl,
    postedAt: postedAt.toISOString(),
  });

  await prisma.product.update({
    where: { id: product.id },
    data: {
      syndicatedAt: postedAt,
      postizPostIds: merged as Prisma.InputJsonValue,
    },
  });

  revalidatePath("/shop");

  return NextResponse.json({
    ok: true,
    mode: "single",
    productId: product.id,
    title: product.title,
    postId: result.id,
    url: result.postUrl,
  });
}
