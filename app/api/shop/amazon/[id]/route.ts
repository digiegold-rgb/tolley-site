import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { amazonAffiliateUrl } from "@/lib/shop";
import { classifyClick } from "@/lib/shop/click-classifier";
import { ensureSubtagsLoaded } from "@/lib/amazon/subtags";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const src = (new URL(request.url).searchParams.get("src") || "").toLowerCase() || null;

  const product = await prisma.product
    .findUnique({ where: { id }, select: { amazonAsin: true } })
    .catch(() => null);

  let asin = product?.amazonAsin ?? null;

  if (!asin) {
    const item = await prisma.shopItem
      .findUnique({ where: { id }, select: { amazonAsin: true } })
      .catch(() => null);
    asin = item?.amazonAsin ?? null;
  }

  await ensureSubtagsLoaded();
  const url = amazonAffiliateUrl(asin, undefined, src);
  if (!url) {
    return NextResponse.json({ error: "No Amazon link" }, { status: 404 });
  }

  const click = await classifyClick(request);

  prisma.siteEvent
    .create({
      data: {
        site: "shop",
        path: `/api/shop/amazon/${id}`,
        event: "amazon_click",
        label: src,
        userAgent: click.ua,
        ip: click.ip,
        meta: {
          asin,
          src,
          isBot: click.isBot,
          botReason: click.reason,
          productId: product ? id : null,
        },
      },
    })
    .catch(() => {});

  if (!click.isBot) {
    if (product) {
      prisma.product
        .update({ where: { id }, data: { amazonClicks: { increment: 1 } } })
        .catch(() => {});
    } else {
      prisma.shopItem
        .update({ where: { id }, data: { amazonClicks: { increment: 1 } } })
        .catch(() => {});
    }
  }

  return NextResponse.redirect(url, 302);
}
