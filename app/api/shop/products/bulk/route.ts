import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateShopAdmin } from "@/lib/shop-auth";
import { revalidatePath } from "next/cache";

export async function POST(req: NextRequest) {
  const isAdmin = await validateShopAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { items, lotId } = body as {
    items: {
      title: string;
      description?: string;
      category?: string;
      imageUrls?: string[];
      costBasis?: number;
      targetPrice?: number;
      condition?: string;
      brand?: string;
    }[];
    lotId?: string;
  };

  if (!items || !items.length) {
    return NextResponse.json({ error: "items[] required" }, { status: 400 });
  }

  // If lotId provided, verify it exists
  if (lotId) {
    const lot = await prisma.sourceLot.findUnique({ where: { id: lotId } });
    if (!lot) {
      return NextResponse.json({ error: "Lot not found" }, { status: 404 });
    }
  }

  const created = [];
  for (const item of items) {
    const product = await prisma.product.create({
      data: {
        title: item.title,
        description: item.description || null,
        category: item.category || null,
        imageUrls: item.imageUrls || [],
        costBasis: item.costBasis || null,
        totalCogs: item.costBasis || null,
        targetPrice: item.targetPrice || null,
        condition: item.condition || null,
        brand: item.brand || null,
        lotId: lotId || null,
        status: "draft",
      },
    });
    created.push(product);
  }

  // Update lot itemsListed count
  if (lotId) {
    const count = await prisma.product.count({ where: { lotId } });
    await prisma.sourceLot.update({
      where: { id: lotId },
      data: { itemsListed: count },
    });
  }

  revalidatePath("/shop");
  return NextResponse.json({ created: created.length, products: created });
}
