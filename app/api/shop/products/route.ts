import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateShopAdmin } from "@/lib/shop-auth";
import { revalidatePath } from "next/cache";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") || "listed";
  const category = searchParams.get("category");
  const platform = searchParams.get("platform");
  const lotId = searchParams.get("lotId");
  const limit = parseInt(searchParams.get("limit") || "100", 10);
  const offset = parseInt(searchParams.get("offset") || "0", 10);

  const where: Record<string, unknown> = {};
  if (status !== "all") where.status = status;
  if (category) where.category = category;
  if (lotId) where.lotId = lotId;
  if (platform) {
    where.listings = { some: { platform, status: { not: "removed" } } };
  }

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      include: { listings: true },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.product.count({ where }),
  ]);

  return NextResponse.json({ products, total });
}

export async function POST(req: NextRequest) {
  const isAdmin = await validateShopAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const {
    title, description, category, subcategory, brand, condition,
    sku, upc, imageUrls, sourcingType, sourcingVendor, lotId,
    costBasis, shippingCost, targetPrice, minPrice, status,
  } = body;

  if (!title) {
    return NextResponse.json({ error: "title required" }, { status: 400 });
  }

  const totalCogs = (costBasis || 0) + (shippingCost || 0) || null;

  const product = await prisma.product.create({
    data: {
      title,
      description: description || null,
      category: category || null,
      subcategory: subcategory || null,
      brand: brand || null,
      condition: condition || null,
      sku: sku || null,
      upc: upc || null,
      imageUrls: imageUrls || [],
      sourcingType: sourcingType || null,
      sourcingVendor: sourcingVendor || null,
      lotId: lotId || null,
      costBasis: costBasis || null,
      shippingCost: shippingCost || null,
      totalCogs,
      targetPrice: targetPrice || null,
      minPrice: minPrice || null,
      status: status || "draft",
    },
    include: { listings: true },
  });

  revalidatePath("/shop");
  return NextResponse.json(product, { status: 201 });
}
