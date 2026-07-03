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

  // Buyer-contact fields live on ShopSale, not Product — pull them off the
  // body before it hits product.update. See MarkSoldModal: all four are
  // optional, so we only log a ShopSale row when the seller actually
  // captured something (list-building infra, not a sales ledger for every
  // sale).
  const { buyerName, buyerPhone, buyerEmail, marketingOptIn, ...productBody } = body;

  // Recalculate totalCogs if cost fields change
  if (productBody.costBasis !== undefined || productBody.shippingCost !== undefined) {
    const existing = await prisma.product.findUnique({ where: { id } });
    if (existing) {
      const costBasis = productBody.costBasis ?? existing.costBasis ?? 0;
      const shippingCost = productBody.shippingCost ?? existing.shippingCost ?? 0;
      productBody.totalCogs = costBasis + shippingCost || null;
    }
  }

  // Set soldAt timestamp when marking sold
  if (productBody.status === "sold" && !productBody.soldAt) {
    productBody.soldAt = new Date();
  }

  const product = await prisma.product.update({
    where: { id },
    data: productBody,
    include: { listings: true },
  });

  const hasBuyerContact = !!(buyerName || buyerPhone || buyerEmail || marketingOptIn);
  if (productBody.status === "sold" && hasBuyerContact) {
    await prisma.shopSale.create({
      data: {
        productId: product.id,
        platform: product.soldPlatform || "facebook",
        title: product.title,
        salePrice: product.soldPrice ?? product.targetPrice ?? 0,
        buyerName: buyerName || null,
        buyerPhone: buyerPhone || null,
        buyerEmail: buyerEmail || null,
        marketingOptIn: !!marketingOptIn,
        soldAt: product.soldAt ?? new Date(),
      },
    });
  }

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
