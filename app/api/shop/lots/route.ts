import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateShopAdmin } from "@/lib/shop-auth";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");

  const where: Record<string, unknown> = {};
  if (status && status !== "all") where.status = status;

  const lots = await prisma.sourceLot.findMany({
    where,
    include: { _count: { select: { products: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(lots);
}

export async function POST(req: NextRequest) {
  const isAdmin = await validateShopAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { name, sourceType, vendorName, purchaseDate, totalCost, estimatedRetail, itemCount, manifestUrl, notes, imageUrls, status } = body;

  // totalCost of 0 is valid — cleanout lots have no acquisition cost
  // (service fee is service revenue; resale is pure margin).
  const cost = typeof totalCost === "string" && totalCost.trim() !== "" ? Number(totalCost) : totalCost;
  if (!name || typeof cost !== "number" || Number.isNaN(cost)) {
    return NextResponse.json({ error: "name and totalCost (number) required" }, { status: 400 });
  }

  const lot = await prisma.sourceLot.create({
    data: {
      name,
      sourceType: sourceType || "liquidation",
      vendorName: vendorName || null,
      purchaseDate: purchaseDate ? new Date(purchaseDate) : null,
      totalCost: cost,
      ...(status ? { status } : {}),
      estimatedRetail: estimatedRetail || null,
      itemCount: itemCount || null,
      manifestUrl: manifestUrl || null,
      notes: notes || null,
      imageUrls: imageUrls || [],
    },
  });

  return NextResponse.json(lot, { status: 201 });
}
