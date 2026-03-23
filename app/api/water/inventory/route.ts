import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateShopAdmin } from "@/lib/shop-auth";

export async function GET() {
  const ok = await validateShopAdmin();
  if (!ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const items = await prisma.poolInventory.findMany({ orderBy: { category: "asc" } });
  const withFlags = items.map((i) => ({
    ...i,
    isLowStock: i.quantity <= i.lowStockThreshold,
  }));

  return NextResponse.json({ items: withFlags });
}

export async function POST(req: NextRequest) {
  const ok = await validateShopAdmin();
  if (!ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { item, category, quantity, unit, lowStockThreshold, notes } = body;

  if (!item || !category) {
    return NextResponse.json({ error: "item and category required" }, { status: 400 });
  }

  const created = await prisma.poolInventory.create({
    data: {
      item,
      category,
      quantity: Number(quantity) || 0,
      unit: unit || "each",
      lowStockThreshold: Number(lowStockThreshold) || 1,
      notes: notes || null,
    },
  });

  return NextResponse.json(created, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const ok = await validateShopAdmin();
  if (!ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { id, quantity, restock } = body;

  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const data: Record<string, unknown> = {};
  if (quantity != null) data.quantity = Number(quantity);
  if (restock) data.lastRestocked = new Date();

  const updated = await prisma.poolInventory.update({ where: { id }, data });

  return NextResponse.json(updated);
}
