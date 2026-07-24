import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { FB_PAGES, TREASURE_HAUL_PAGE_ID, getPageToken, publishToPage } from "@/lib/facebook";
import {
  formatTreasureHaulCaption,
  pickBackfillTreasureHaulProducts,
  pickPrimaryImageUrl,
  mergeTreasureHaulPostId,
  alertDiscord,
} from "@/lib/shop/treasure-haul-post";
import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";

export const runtime = "nodejs";
export const maxDuration = 60;

// Evening single-product spotlight, Mon–Fri. With the daily digest (7/wk),
// Saturday top finds (1), amazon picks (3) and the 2/day shorts FB leg (14),
// these 5 land the page exactly on the 30-posts/week target.
const SPOTLIGHT_COOLDOWN_DAYS = 30;

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const page = FB_PAGES.find((p) => p.id === TREASURE_HAUL_PAGE_ID);
  if (!page) {
    return NextResponse.json({ ok: false, error: "Treasure Haul page not configured" }, { status: 500 });
  }
  const token = getPageToken(page);
  if (!token) {
    await alertDiscord(`spotlight cron failed: ${page.tokenEnvKey} not set`);
    return NextResponse.json({ ok: false, error: `${page.tokenEnvKey} not set` }, { status: 503 });
  }

  // The spotlight is pure backlog, so it depends entirely on the FB mirror
  // keeping `listed` honest — with a stale mirror we'd risk posting sold
  // items ("same photos even though sold"). Skip outright instead.
  const freshest = await prisma.product.findFirst({
    where: { lastFbCheckAt: { not: null } },
    orderBy: { lastFbCheckAt: "desc" },
    select: { lastFbCheckAt: true },
  });
  const mirrorAgeMs = freshest?.lastFbCheckAt
    ? Date.now() - freshest.lastFbCheckAt.getTime()
    : Number.POSITIVE_INFINITY;
  if (mirrorAgeMs > 24 * 60 * 60 * 1000) {
    await alertDiscord(
      `spotlight: FB mirror stale (${
        Number.isFinite(mirrorAgeMs) ? `${Math.round(mirrorAgeMs / 3_600_000)}h` : "never synced"
      }) — skipping backlog post. Check fb-draft-worker on the DGX.`,
    );
    return NextResponse.json({ ok: true, skipped: "mirror stale" });
  }

  const [product] = await pickBackfillTreasureHaulProducts(1, SPOTLIGHT_COOLDOWN_DAYS, []);
  if (!product) {
    return NextResponse.json({ ok: true, skipped: "catalog exhausted — nothing outside cooldown" });
  }
  const imageUrl = pickPrimaryImageUrl(product);
  if (!imageUrl) {
    return NextResponse.json({ ok: true, skipped: "picked product has no image", productId: product.id });
  }

  const caption = formatTreasureHaulCaption({ product, listings: product.listings });
  let result;
  try {
    result = await publishToPage(page.id, token, { message: caption, imageUrl });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "publishToPage failed";
    await alertDiscord(`spotlight publish failed: ${msg}`);
    return NextResponse.json({ ok: false, error: msg, mode: "spotlight" }, { status: 502 });
  }

  const postedAt = new Date();
  const merged = mergeTreasureHaulPostId(product.postizPostIds, {
    id: result.id,
    url: result.postUrl,
    postedAt: postedAt.toISOString(),
  });
  await prisma.product.update({
    where: { id: product.id },
    data: { syndicatedAt: postedAt, postizPostIds: merged as Prisma.InputJsonValue },
  });
  revalidatePath("/shop");

  return NextResponse.json({
    ok: true,
    mode: "spotlight",
    productId: product.id,
    title: product.title,
    postId: result.id,
    url: result.postUrl,
  });
}
