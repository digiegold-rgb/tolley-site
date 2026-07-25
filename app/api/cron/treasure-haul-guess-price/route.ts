import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { FB_PAGES, TREASURE_HAUL_PAGE_ID, getPageToken, publishToPage } from "@/lib/facebook";
import {
  pickBackfillTreasureHaulProducts,
  pickPrimaryImageUrl,
  alertDiscord,
} from "@/lib/shop/treasure-haul-post";
import type { Prisma } from "@prisma/client";

export const runtime = "nodejs";
export const maxDuration = 60;

// "Guess the Price" — the page's only conversation-starter post type.
// Friday: mystery photo, NO price and NO link (either would give it away),
// guesses in the comments. Saturday: price reveal with the shop link.
// One cron entry fires both days (0 22 * * 5,6 UTC = 17:00 CT) and the
// route branches on day-of-week.
const GUESS_COOLDOWN_DAYS = 30;

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

type GuessStamp = {
  id: string;
  url: string;
  postedAt: string;
  revealPending: boolean;
};

function readGuessStamp(postizPostIds: unknown): GuessStamp | null {
  if (!postizPostIds || typeof postizPostIds !== "object" || Array.isArray(postizPostIds)) return null;
  const raw = (postizPostIds as Record<string, unknown>).guessPrice;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const s = raw as Record<string, unknown>;
  if (typeof s.id !== "string" || typeof s.postedAt !== "string") return null;
  return {
    id: s.id,
    url: typeof s.url === "string" ? s.url : "",
    postedAt: s.postedAt,
    revealPending: s.revealPending === true,
  };
}

function mergeGuessStamp(existing: unknown, stamp: GuessStamp): Prisma.InputJsonValue {
  const base =
    existing && typeof existing === "object" && !Array.isArray(existing)
      ? (existing as Record<string, unknown>)
      : {};
  return { ...base, guessPrice: { ...stamp } } as Prisma.InputJsonValue;
}

function teaseCaption(title: string): string {
  return [
    "🕵️‍♀️ GUESS THE PRICE — Friday edition!",
    "",
    `This week's mystery find: ${title.trim()}`,
    "",
    "Drop your best guess in the comments 👇 No hints, no peeking at the shop.",
    "Closest guess gets eternal bragging rights.",
    "",
    "💰 Price reveal tomorrow in the Saturday roundup!",
    "",
    "#guesstheprice #treasurehaul #thrifting #kansascity",
  ].join("\n");
}

function revealCaption(title: string, price: number | null, shopUrl: string): string {
  const priceLine = price !== null ? `💰 The answer: $${price.toFixed(0)}!` : "💰 The answer is on the shop page!";
  return [
    "🎉 PRICE REVEAL — yesterday's mystery find:",
    "",
    title.trim(),
    priceLine,
    "",
    "Did you guess it? Tell us how close you got 👇",
    `🛒 Still available: ${shopUrl}`,
    "",
    "New mystery find next Friday — ➕ Follow Ruthann's Treasure Haul so you don't miss it.",
    "",
    "#guesstheprice #treasurehaul #thrifting #kansascity",
  ].join("\n");
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
    await alertDiscord(`guess-price cron failed: ${page.tokenEnvKey} not set`);
    return NextResponse.json({ ok: false, error: `${page.tokenEnvKey} not set` }, { status: 503 });
  }

  // Chicago-local day decides tease vs reveal (cron fires 22:00 UTC Fri+Sat).
  const day = new Date().toLocaleDateString("en-US", { weekday: "short", timeZone: "America/Chicago" });

  if (day === "Sat") return runReveal(token, page.id);
  return runTease(token, page.id);
}

async function runTease(token: string, pageId: string) {
  // Backlog picker guarantees image + price + in-season + actually listed.
  const [product] = await pickBackfillTreasureHaulProducts(1, GUESS_COOLDOWN_DAYS, []);
  if (!product) {
    return NextResponse.json({ ok: true, skipped: "catalog exhausted — nothing outside cooldown" });
  }
  const imageUrl = pickPrimaryImageUrl(product);
  if (!imageUrl) {
    return NextResponse.json({ ok: true, skipped: "picked product has no image", productId: product.id });
  }

  let result;
  try {
    result = await publishToPage(pageId, token, {
      message: teaseCaption(product.title),
      imageUrl,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "publishToPage failed";
    await alertDiscord(`guess-price tease publish failed: ${msg}`);
    return NextResponse.json({ ok: false, error: msg, mode: "tease" }, { status: 502 });
  }

  const postedAt = new Date();
  const merged = mergeGuessStamp(product.postizPostIds, {
    id: result.id,
    url: result.postUrl,
    postedAt: postedAt.toISOString(),
    revealPending: true,
  });
  // syndicatedAt too, so the digest/spotlight don't re-post the mystery item
  // (with its price) before Saturday's reveal.
  await prisma.product.update({
    where: { id: product.id },
    data: { syndicatedAt: postedAt, postizPostIds: merged },
  });

  return NextResponse.json({
    ok: true,
    mode: "tease",
    productId: product.id,
    title: product.title,
    postId: result.id,
    url: result.postUrl,
  });
}

async function runReveal(token: string, pageId: string) {
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id FROM "Product"
    WHERE "postizPostIds"->'guessPrice'->>'revealPending' = 'true'
    ORDER BY ("postizPostIds"->'guessPrice'->>'postedAt') DESC
    LIMIT 1
  `;
  if (rows.length === 0) {
    return NextResponse.json({ ok: true, skipped: "no pending reveal" });
  }
  const product = await prisma.product.findUnique({
    where: { id: rows[0].id },
    include: { listings: true },
  });
  if (!product) {
    return NextResponse.json({ ok: true, skipped: "pending-reveal product vanished" });
  }
  const stamp = readGuessStamp(product.postizPostIds);
  const imageUrl = pickPrimaryImageUrl(product);

  const shopListing = product.listings.find((l) => l.platform === "shop" && l.status !== "removed");
  const price = shopListing?.price ?? product.targetPrice ?? null;
  const shopUrl = product.goSlug
    ? `https://www.tolley.io/go/${product.goSlug}?src=brand_fb`
    : `https://www.tolley.io/shop/${product.id}?utm_source=facebook_brand_page&utm_medium=organic`;

  let result;
  try {
    result = await publishToPage(pageId, token, {
      message: revealCaption(product.title, price, shopUrl),
      ...(imageUrl ? { imageUrl } : {}),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "publishToPage failed";
    await alertDiscord(`guess-price reveal publish failed: ${msg}`);
    return NextResponse.json({ ok: false, error: msg, mode: "reveal" }, { status: 502 });
  }

  const merged = mergeGuessStamp(product.postizPostIds, {
    id: stamp?.id ?? "",
    url: stamp?.url ?? "",
    postedAt: stamp?.postedAt ?? new Date().toISOString(),
    revealPending: false,
  });
  await prisma.product.update({
    where: { id: product.id },
    data: { postizPostIds: merged },
  });

  return NextResponse.json({
    ok: true,
    mode: "reveal",
    productId: product.id,
    title: product.title,
    price,
    postId: result.id,
    url: result.postUrl,
  });
}
