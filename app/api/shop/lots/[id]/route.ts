import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateShopAdmin } from "@/lib/shop-auth";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const lot = await prisma.sourceLot.findUnique({
    where: { id },
    include: {
      products: {
        include: { listings: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!lot) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(lot);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const isAdmin = await validateShopAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();

  if (body.purchaseDate) {
    body.purchaseDate = new Date(body.purchaseDate);
  }

  const lot = await prisma.sourceLot.update({
    where: { id },
    data: body,
  });

  return NextResponse.json(lot);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const isAdmin = await validateShopAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  // Unlink products from lot before deleting
  await prisma.product.updateMany({
    where: { lotId: id },
    data: { lotId: null },
  });
  await prisma.sourceLot.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
