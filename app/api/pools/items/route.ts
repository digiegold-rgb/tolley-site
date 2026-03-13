import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { validateShopAdmin } from "@/lib/shop-auth";
import { POOL_CATEGORIES } from "@/lib/pools";

// GET /api/pools/items?category=Chemicals&status=active
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") || "active";
  const category = searchParams.get("category");

  const where: Record<string, unknown> = {};
  if (status !== "all") {
    where.status = status;
  }
  if (category) {
    where.category = category;
  }

  const items = await prisma.poolProduct.findMany({
    where,
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  return NextResponse.json(items);
}

// POST /api/pools/items — create product (admin only)
export async function POST(request: NextRequest) {
  const isAdmin = await validateShopAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { sku, name, description, category, price, costPrice, retailPrice, imageUrl, brand, unit, size, featured, sortOrder } = body;

    if (!sku || typeof sku !== "string" || sku.trim().length === 0) {
      return NextResponse.json({ error: "SKU required" }, { status: 400 });
    }
    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json({ error: "Name required" }, { status: 400 });
    }
    if (typeof price !== "number" || price < 0) {
      return NextResponse.json({ error: "Valid price required" }, { status: 400 });
    }
    if (category && !POOL_CATEGORIES.includes(category)) {
      return NextResponse.json({ error: "Invalid category" }, { status: 400 });
    }

    const product = await prisma.poolProduct.create({
      data: {
        sku: sku.trim(),
        name: name.trim(),
        description: description?.trim() || null,
        category: category || null,
        price,
        costPrice: costPrice ?? null,
        retailPrice: retailPrice ?? null,
        imageUrl: imageUrl?.trim() || null,
        brand: brand?.trim() || null,
        unit: unit?.trim() || null,
        size: size?.trim() || null,
        featured: featured ?? false,
        sortOrder: sortOrder ?? 0,
      },
    });

    revalidatePath("/pools");

    return NextResponse.json(product, { status: 201 });
  } catch (err) {
    console.error("[pools/items POST]", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: "Bad request", detail: message }, { status: 400 });
  }
}
