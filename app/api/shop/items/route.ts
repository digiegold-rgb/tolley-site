import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { validateShopAdmin } from "@/lib/shop-auth";
import { SHOP_CATEGORIES } from "@/lib/shop";

// GET /api/shop/items?status=active&category=Furniture
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

  const items = await prisma.shopItem.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(items);
}

// POST /api/shop/items — create item (admin only)
export async function POST(request: NextRequest) {
  const isAdmin = await validateShopAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { title, price, description, category, imageUrls } = body;

    if (!title || typeof title !== "string" || title.trim().length === 0) {
      return NextResponse.json({ error: "Title required" }, { status: 400 });
    }
    if (typeof price !== "number" || price < 0) {
      return NextResponse.json({ error: "Valid price required" }, { status: 400 });
    }
    if (category && !SHOP_CATEGORIES.includes(category)) {
      return NextResponse.json({ error: "Invalid category" }, { status: 400 });
    }

    const item = await prisma.shopItem.create({
      data: {
        title: title.trim(),
        price,
        description: description?.trim() || null,
        category: category || null,
        imageUrls: imageUrls || [],
      },
    });

    // Bust the ISR cache so /shop shows the new item immediately
    revalidatePath("/shop");

    return NextResponse.json(item, { status: 201 });
  } catch (err) {
    console.error("[shop/items POST]", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: "Bad request", detail: message }, { status: 400 });
  }
}
