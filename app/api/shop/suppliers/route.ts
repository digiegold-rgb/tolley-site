import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateShopAdmin } from "@/lib/shop-auth";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");
  const activeOnly = searchParams.get("active") !== "false";

  const where: Record<string, unknown> = {};
  if (type) where.type = type;
  if (activeOnly) where.isActive = true;

  const suppliers = await prisma.supplier.findMany({
    where,
    orderBy: { name: "asc" },
  });

  return NextResponse.json(suppliers);
}

export async function POST(req: NextRequest) {
  const isAdmin = await validateShopAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { name, type, website, contactEmail, contactPhone, location, notes, rating, avgDiscount, categories } = body;

  if (!name) {
    return NextResponse.json({ error: "name required" }, { status: 400 });
  }

  const supplier = await prisma.supplier.create({
    data: {
      name,
      type: type || "wholesale",
      website: website || null,
      contactEmail: contactEmail || null,
      contactPhone: contactPhone || null,
      location: location || null,
      notes: notes || null,
      rating: rating || null,
      avgDiscount: avgDiscount || null,
      categories: categories || [],
    },
  });

  return NextResponse.json(supplier, { status: 201 });
}
