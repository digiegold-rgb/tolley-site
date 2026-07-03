import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const expected = "Bearer " + process.env.SYNC_SECRET;

  if (!authHeader || authHeader !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { sku, description, features, specs, upc, sdsUrl, warranty, weight, dimensions, stockQty } = body;

    if (!sku) {
      return NextResponse.json({ error: "sku required" }, { status: 400 });
    }

    const existing = await prisma.poolProduct.findUnique({ where: { sku } });
    if (!existing) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    await prisma.poolProduct.update({
      where: { sku },
      data: {
        ...(description ? { description } : {}),
        ...(features ? { features } : {}),
        ...(specs ? { specs } : {}),
        ...(upc ? { upc } : {}),
        ...(sdsUrl ? { sdsUrl } : {}),
        ...(warranty ? { warranty } : {}),
        ...(weight ? { weight } : {}),
        ...(dimensions ? { dimensions } : {}),
        ...(stockQty != null ? { stockQty, stockStatus: stockQty <= 0 ? "out-of-stock" : stockQty <= 5 ? "low-stock" : "in-stock" } : {}),
        enrichedAt: new Date(),
      },
    });

    return NextResponse.json({ ok: true, sku });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
