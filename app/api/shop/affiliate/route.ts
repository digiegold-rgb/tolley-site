import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateShopAdmin } from "@/lib/shop-auth";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const network = searchParams.get("network");
  const activeOnly = searchParams.get("active") !== "false";

  const where: Record<string, unknown> = {};
  if (network) where.network = network;
  if (activeOnly) where.isActive = true;

  const links = await prisma.affiliateLink.findMany({
    where,
    orderBy: { clicks: "desc" },
  });

  return NextResponse.json(links);
}

export async function POST(req: NextRequest) {
  const isAdmin = await validateShopAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { network, productUrl, affiliateUrl, shortCode, title, category, imageUrl } = body;

  if (!network || !productUrl || !affiliateUrl || !shortCode) {
    return NextResponse.json({ error: "network, productUrl, affiliateUrl, shortCode required" }, { status: 400 });
  }

  // Check shortCode uniqueness
  const existing = await prisma.affiliateLink.findUnique({ where: { shortCode } });
  if (existing) {
    return NextResponse.json({ error: "shortCode already in use" }, { status: 409 });
  }

  const link = await prisma.affiliateLink.create({
    data: {
      network,
      productUrl,
      affiliateUrl,
      shortCode,
      title: title || null,
      category: category || null,
      imageUrl: imageUrl || null,
    },
  });

  return NextResponse.json(link, { status: 201 });
}
