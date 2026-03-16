import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateShopAdmin } from "@/lib/shop-auth";
import { revalidatePath } from "next/cache";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const product = await prisma.product.findUnique({
    where: { id },
    include: { listings: true, priceHistory: { take: 20, orderBy: { capturedAt: "desc" } }, sales: true, sourceLot: true },
  });
  if (!product) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(product);
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

  // Recalculate totalCogs if cost fields change
  if (body.costBasis !== undefined || body.shippingCost !== undefined) {
    const existing = await prisma.product.findUnique({ where: { id } });
    if (existing) {
      const costBasis = body.costBasis ?? existing.costBasis ?? 0;
      const shippingCost = body.shippingCost ?? existing.shippingCost ?? 0;
      body.totalCogs = costBasis + shippingCost || null;
    }
  }

  // Set soldAt timestamp when marking sold
  if (body.status === "sold" && !body.soldAt) {
    body.soldAt = new Date();
  }

  const product = await prisma.product.update({
    where: { id },
    data: body,
    include: { listings: true },
  });

  revalidatePath("/shop");
  return NextResponse.json(product);
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
  await prisma.product.delete({ where: { id } });
  revalidatePath("/shop");
  return NextResponse.json({ ok: true });
}
