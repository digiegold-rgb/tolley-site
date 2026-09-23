import { syncInventoryAfterResponse } from "@/lib/shop/inventory-after";
import { changeInventory, inventoryTransaction, InventoryError } from "@/lib/shop/inventory";
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

  if (productId) {
    if (!body.inventoryKey && !externalId) return NextResponse.json({ error: "A unique sale reference is required" }, { status: 400 });
    try {
      const result = await inventoryTransaction(async tx => {
        const key = body.inventoryKey || `sale:${platform}:${externalId}`;
        const result = await changeInventory(tx, { productId, key, action: "sale", channel: platform, quantity: body.quantity ?? 1, salePrice });
        if (result.replay) return tx.shopSale.findFirst({ where: { productId, externalId: key, platform } });
        return tx.shopSale.create({ data: { productId, externalId: key, platform, title, salePrice, platformFees, shippingCost, cogs, buyerName, buyerLocation, paymentMethod, netProfit: salePrice - (platformFees || 0) - (shippingCost || 0) - (cogs || 0) } });
      });
      syncInventoryAfterResponse(productId);
      return NextResponse.json(result);
    } catch (e) { return NextResponse.json({ error: e instanceof InventoryError ? e.message : "Could not record sale" }, { status: e instanceof InventoryError ? e.status : 500 }); }
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

  return NextResponse.json(sale, { status: 201 });
}
