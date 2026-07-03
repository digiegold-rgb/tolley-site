import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { amazonSearchUrl } from "@/lib/shop";

export const runtime = "nodejs";

/**
 * Tracked redirect for Amazon search-results fallback. Used when a product
 * has no 1:1 ASIN match but we still want to send the user to Amazon with
 * our affiliate tag attached. Compliance basis: Operating Agreement allows
 * "related Product detail page or other relevant page" — search results for
 * product-relevant keywords qualify.
 *
 * Prefers `searchKeywords` (curated 3–6 generic terms) over raw `title`
 * because FB-Marketplace-style descriptions ("Bamboo Wire Rack Shelving
 * Covers") often produce poor Amazon search results.
 *
 * Increments `amazonSearchClicks` so we can measure fallback CTR vs direct.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const src =
    (new URL(request.url).searchParams.get("src") || "").toLowerCase() || null;

  const product = await prisma.product
    .findUnique({
      where: { id },
      select: { searchKeywords: true, title: true },
    })
    .catch(() => null);

  let query = product?.searchKeywords?.trim() || product?.title?.trim() || null;
  let isProduct = !!product;

  if (!query) {
    const item = await prisma.shopItem
      .findUnique({
        where: { id },
        select: { searchKeywords: true, title: true },
      })
      .catch(() => null);
    if (item) {
      query = item.searchKeywords?.trim() || item.title?.trim() || null;
      isProduct = false;
    }
  }

  const url = amazonSearchUrl(query, undefined, src);
  if (!url) {
    return NextResponse.json({ error: "No search query" }, { status: 404 });
  }

  if (isProduct) {
    await prisma.product
      .update({ where: { id }, data: { amazonSearchClicks: { increment: 1 } } })
      .catch(() => {});
  } else {
    await prisma.shopItem
      .update({ where: { id }, data: { amazonSearchClicks: { increment: 1 } } })
      .catch(() => {});
  }

  return NextResponse.redirect(url, 302);
}
