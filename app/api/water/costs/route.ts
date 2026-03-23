import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateShopAdmin } from "@/lib/shop-auth";

export async function GET(req: NextRequest) {
  const ok = await validateShopAdmin();
  if (!ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = req.nextUrl;
  const season = url.searchParams.get("season");
  const category = url.searchParams.get("category");
  const summary = url.searchParams.get("summary") === "true";

  const where: Record<string, unknown> = {};
  if (season) where.season = Number(season);
  if (category) where.category = category;

  if (summary) {
    const costs = await prisma.poolCost.findMany({ where, orderBy: { purchaseDate: "asc" } });
    const bySeason: Record<number, Record<string, number>> = {};
    let total = 0;
    for (const c of costs) {
      if (!bySeason[c.season]) bySeason[c.season] = {};
      bySeason[c.season][c.category] = (bySeason[c.season][c.category] || 0) + c.amount;
      total += c.amount;
    }
    return NextResponse.json({ bySeason, total });
  }

  const costs = await prisma.poolCost.findMany({
    where,
    orderBy: { purchaseDate: "desc" },
  });

  return NextResponse.json({ costs });
}

export async function POST(req: NextRequest) {
  const ok = await validateShopAdmin();
  if (!ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { season, category, item, amount, quantity, unit, vendor, notes, purchaseDate } = body;

  if (!season || !category || !item || amount == null) {
    return NextResponse.json({ error: "season, category, item, and amount are required" }, { status: 400 });
  }

  const cost = await prisma.poolCost.create({
    data: {
      season: Number(season),
      category,
      item,
      amount: Number(amount),
      quantity: quantity != null ? Number(quantity) : null,
      unit: unit || null,
      vendor: vendor || null,
      notes: notes || null,
      purchaseDate: purchaseDate ? new Date(purchaseDate) : new Date(),
    },
  });

  return NextResponse.json(cost, { status: 201 });
}
