import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateShopAdmin } from "@/lib/shop-auth";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const platform = searchParams.get("platform");
  const limit = parseInt(searchParams.get("limit") || "50", 10);
  const days = parseInt(searchParams.get("days") || "30", 10);

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const where: Record<string, unknown> = {
    soldAt: { gte: since },
  };
  if (platform) where.platform = platform;

  const sales = await prisma.shopSale.findMany({
    where,
    include: {
      product: {
        select: { id: true, title: true, imageUrls: true, category: true },
      },
    },
    orderBy: { soldAt: "desc" },
    take: limit,
  });

  return NextResponse.json(sales);
}

export async function POST(req: NextRequest) {
  const isAdmin = await validateShopAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const {
    productId, platform, externalId, title, salePrice,
    platformFees, shippingCost, cogs, buyerName, buyerLocation, paymentMethod,
  } = body;

  if (!title || !salePrice || !platform) {
    return NextResponse.json({ error: "title, salePrice, platform required" }, { status: 400 });
  }

  const netProfit = (salePrice || 0) - (platformFees || 0) - (shippingCost || 0) - (cogs || 0);

  const sale = await prisma.shopSale.create({
    data: {
      productId: productId || null,
      platform,
      externalId: externalId || null,
      title,
      salePrice,
      platformFees: platformFees || null,
      shippingCost: shippingCost || null,
      cogs: cogs || null,
      netProfit,
      buyerName: buyerName || null,
      buyerLocation: buyerLocation || null,
      paymentMethod: paymentMethod || null,
    },
  });

  // Update product if linked
  if (productId) {
    await prisma.product.update({
      where: { id: productId },
      data: {
        status: "sold",
        soldPrice: salePrice,
        soldAt: new Date(),
        soldPlatform: platform,
        totalFees: platformFees || null,
        netProfit,
        roi: cogs && cogs > 0 ? Math.round((netProfit / cogs) * 10000) / 100 : null,
      },
    });
  }

  return NextResponse.json(sale, { status: 201 });
}
