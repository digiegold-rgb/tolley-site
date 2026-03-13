import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { validateShopAdmin } from "@/lib/shop-auth";

// PATCH /api/pools/items/[id] — update product (admin only)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const isAdmin = await validateShopAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const data: Record<string, unknown> = {};

    if (body.name !== undefined) data.name = body.name.trim();
    if (body.description !== undefined) data.description = body.description?.trim() || null;
    if (body.category !== undefined) data.category = body.category || null;
    if (body.price !== undefined) data.price = body.price;
    if (body.costPrice !== undefined) data.costPrice = body.costPrice;
    if (body.retailPrice !== undefined) data.retailPrice = body.retailPrice;
    if (body.imageUrl !== undefined) data.imageUrl = body.imageUrl?.trim() || null;
    if (body.brand !== undefined) data.brand = body.brand?.trim() || null;
    if (body.unit !== undefined) data.unit = body.unit?.trim() || null;
    if (body.size !== undefined) data.size = body.size?.trim() || null;
    if (body.status !== undefined) data.status = body.status;
    if (body.featured !== undefined) data.featured = body.featured;
    if (body.sortOrder !== undefined) data.sortOrder = body.sortOrder;

    const product = await prisma.poolProduct.update({
      where: { id },
      data,
    });

    revalidatePath("/pools");

    return NextResponse.json(product);
  } catch (err) {
    console.error("[pools/items PATCH]", err);
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }
}

// DELETE /api/pools/items/[id] — delete product (admin only)
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const isAdmin = await validateShopAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    await prisma.poolProduct.delete({ where: { id } });

    revalidatePath("/pools");

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[pools/items DELETE]", err);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}
