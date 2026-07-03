/**
 * POST /api/shop/deals/[id]/source — convert a RetailDeal into a draft Product.
 * Auth: shop admin session.
 *
 * Idempotent: re-sourcing an already-sourced deal returns the existing product.
 * After this, the standard /api/shop/products/[id]/fb-draft flow takes over to
 * push the item to Ruthann's Treasure Haul (FB Marketplace).
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateShopAdmin } from "@/lib/shop-auth";
import { SHOP_CATEGORIES, type ShopCategory } from "@/lib/shop";

// Lightweight keyword → category inference. Most scanned items are tools, so
// that's the fallback; the rest catch obvious non-tool finds.
function inferCategory(title: string): ShopCategory {
  const t = title.toLowerCase();
  const rules: [RegExp, ShopCategory][] = [
    [/\b(drill|saw|wrench|tool|driver|grinder|sander|nailer|router|impact)\b/, "Tools"],
    [/\b(thermostat|camera|router|smart|alexa|echo|tablet|monitor|tv|speaker|headphone|charger)\b/, "Electronics"],
    [/\b(kitchen|cookware|blender|mixer|fryer|cook|knife|pan|pot)\b/, "Kitchen"],
    [/\b(patio|garden|grill|mower|hose|planter|outdoor|furniture|chair|table|shelf)\b/, "Home"],
    [/\b(tire|car|auto|motor|oil|battery jump|wiper)\b/, "Automotive"],
    [/\b(toy|lego|game|puzzle|doll)\b/, "Toys"],
  ];
  for (const [re, cat] of rules) if (re.test(t)) return cat;
  return "Tools";
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await validateShopAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const deal = await prisma.retailDeal.findUnique({ where: { id } });
  if (!deal) {
    return NextResponse.json({ error: "Deal not found" }, { status: 404 });
  }

  // Idempotency: already sourced → return existing product if it still exists.
  if (deal.productId) {
    const existing = await prisma.product.findUnique({
      where: { id: deal.productId },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json({ productId: existing.id, alreadySourced: true });
    }
  }

  const category = inferCategory(deal.title);
  const sellPrice = deal.resaleMedian ?? Math.round(deal.buyPrice * 1.5);
  const sourceNote = `Sourced via Deal Scanner from ${deal.retailerLabel}${
    deal.onClearance ? " (clearance" + (deal.originalPrice ? ` — was $${deal.originalPrice.toFixed(2)}` : "") + ")" : ""
  }. Buy $${deal.buyPrice.toFixed(2)} → eBay sold median ~$${(deal.resaleMedian ?? 0).toFixed(
    2
  )} (${deal.resaleSamples} comps).${deal.productUrl ? `\nStore listing: ${deal.productUrl}` : ""}`;

  const product = await prisma.product.create({
    data: {
      title: deal.title.slice(0, 200),
      description: sourceNote,
      category: SHOP_CATEGORIES.includes(category) ? category : "Other",
      condition: "New",
      brand: deal.brand || undefined,
      sku: deal.externalId,
      imageUrls: deal.imageUrl ? [deal.imageUrl] : [],
      sourcingType: "retail_arbitrage",
      sourcingVendor: deal.retailerLabel,
      costBasis: deal.buyPrice,
      shippingCost: 0,
      totalCogs: deal.buyPrice,
      aiSuggestedPrice: deal.resaleMedian ?? undefined,
      targetPrice: sellPrice,
      minPrice: Math.max(Math.round(deal.buyPrice * 1.3), Math.round(sellPrice * 0.8)),
      status: "draft",
    },
    select: { id: true },
  });

  await prisma.retailDeal.update({
    where: { id: deal.id },
    data: { status: "sourced", productId: product.id, sourcedAt: new Date() },
  });

  return NextResponse.json({ productId: product.id, alreadySourced: false });
}
