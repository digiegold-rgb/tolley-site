import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  FB_PAGES,
  TREASURE_HAUL_PAGE_ID,
  commentOnPost,
  getPageToken,
  publishCarouselToPage,
} from "@/lib/facebook";
import {
  buildBrandPageGoComment,
  formatTreasureHaulCarouselCaption,
  pickPrimaryImageUrl,
  pickWeeklyTopProducts,
  mergeTreasureHaulPostId,
  alertDiscord,
} from "@/lib/shop/treasure-haul-post";
import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";

export const runtime = "nodejs";
export const maxDuration = 60;

const HIGHLIGHT_COUNT = 3;

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
    await alertDiscord(`weekly cron failed: ${page.tokenEnvKey} not set`);
    return NextResponse.json(
      { ok: false, error: `${page.tokenEnvKey} not set` },
      { status: 503 }
    );
  }

  const products = await pickWeeklyTopProducts(HIGHLIGHT_COUNT, 7);
  if (products.length === 0) {
    return NextResponse.json({ ok: true, skipped: "no eligible products" });
  }

  const items = products
    .map((p) => {
      const url = pickPrimaryImageUrl(p);
      return url ? { imageUrl: url, altCaption: p.title } : null;
    })
    .filter((x): x is { imageUrl: string; altCaption: string } => x !== null);

  if (items.length === 0) {
    return NextResponse.json({ ok: true, skipped: "no products with usable images" });
  }

  const caption = formatTreasureHaulCarouselCaption({
    variant: "weekly_highlight",
    products,
  });

  let result;
  try {
    result = await publishCarouselToPage(page.id, token, items, caption);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "publishCarouselToPage failed";
    await alertDiscord(`weekly cron failed: ${msg}`);
    return NextResponse.json({ ok: false, error: msg }, { status: 502 });
  }

  try {
    await commentOnPost(result.id, token, buildBrandPageGoComment());
  } catch (err) {
    console.warn("[treasure-haul-weekly] first-comment failed (non-fatal):", err);
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
    mode: "weekly_highlight",
    products: products.map((p) => ({ id: p.id, title: p.title })),
    postId: result.id,
    url: result.postUrl,
  });
}
