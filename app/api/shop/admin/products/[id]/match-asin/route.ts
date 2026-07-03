import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateShopAdmin } from "@/lib/shop-auth";
import { matchAsinByImage } from "@/lib/amazon/lens-match";

export const maxDuration = 30;

/**
 * POST /api/shop/admin/products/[id]/match-asin
 *
 * Tries reverse-image search via Google Lens to find an Amazon ASIN for the
 * product. Saves the result to product.amazonAsin if found. Useful for items
 * where the text-based SerpAPI Amazon search comes up empty (mostly visual
 * products like home decor, branded apparel, oddly-named thrift finds).
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await validateShopAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const product = await prisma.product.findUnique({
    where: { id },
    select: { id: true, amazonAsin: true, imageUrls: true, title: true },
  });

  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  const images = (product.imageUrls ?? []).filter(
    (u): u is string => typeof u === "string" && /^https?:\/\//.test(u)
  );
  if (images.length === 0) {
    return NextResponse.json(
      { error: "Product has no public image URLs", productId: id },
      { status: 400 }
    );
  }

  // Try up to 3 images (front, back, detail) before giving up
  let match = null;
  for (const img of images.slice(0, 3)) {
    match = await matchAsinByImage(img, "shop-lens-match");
    if (match) break;
  }

  if (!match) {
    return NextResponse.json({
      productId: id,
      matched: false,
      previousAsin: product.amazonAsin,
    });
  }

  await prisma.product.update({
    where: { id },
    data: {
      amazonAsin: match.asin,
      asinMatchedAt: new Date(),
      asinMatchScore: 0.5, // Lens matches don't have native scores
    },
  });

  return NextResponse.json({
    productId: id,
    matched: true,
    asin: match.asin,
    title: match.title,
    link: match.link,
    previousAsin: product.amazonAsin,
  });
}
