import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { ASIN_NOT_FOUND_HINT, plainAmazonUrl, resolveAsinFromInput } from "@/lib/shop/amazon-asin";
import { ITEM_INCLUDE, cachedAmazonPriceCents } from "@/lib/stream/lineup";
import { validateWdAdmin } from "@/lib/wd-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 15;

// Paste-to-replace the Amazon link for ONE lineup item. { url } — full URL, a.co / amzn.to share link, or bare ASIN.
// Stored as a plain /dp/<ASIN> link (no affiliate tag) and marked verified, since a human just picked it.
// The Product's own amazonAsin (which feeds the public shop's affiliate links) is left alone.
export async function POST(request: NextRequest, ctx: { params: Promise<{ slug: string; itemId: string }> }) {
  const { authed } = await validateWdAdmin();
  if (!authed) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { slug, itemId } = await ctx.params;
  const body = await request.json().catch(() => ({}));
  const raw = String(body?.url ?? "").trim();
  if (!raw) return NextResponse.json({ error: "Missing url" }, { status: 400 });

  const found = await prisma.streamLineupItem.findFirst({ where: { id: itemId, lineup: { slug } }, select: { id: true } });
  if (!found) return NextResponse.json({ error: "not found" }, { status: 404 });

  const { asin, resolvedFrom } = await resolveAsinFromInput(raw);
  if (!asin) {
    const detail = resolvedFrom ? ` (resolved to ${new URL(resolvedFrom).hostname})` : "";
    return NextResponse.json({ error: `Could not find an ASIN in that URL${detail}. ${ASIN_NOT_FOUND_HINT}` }, { status: 422 });
  }

  const item = await prisma.streamLineupItem.update({
    where: { id: found.id },
    // specsCheckedAt: null → the DGX lineup-specs worker reads this product's live price + package specs.
    data: { amazonUrl: plainAmazonUrl(asin), amazonVerified: true, amazonPriceCents: await cachedAmazonPriceCents(asin), amazonTitle: null, amazonPriceAt: null, specsCheckedAt: null },
    include: ITEM_INCLUDE,
  });
  return NextResponse.json({ item, asin });
}
