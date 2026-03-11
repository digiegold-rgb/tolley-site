import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { validateShopAdmin } from "@/lib/shop-auth";
import { del } from "@vercel/blob";

// PATCH /api/shop/items/[id] — update item (admin only)
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

    if (body.title !== undefined) data.title = body.title.trim();
    if (body.price !== undefined) data.price = body.price;
    if (body.description !== undefined) data.description = body.description?.trim() || null;
    if (body.category !== undefined) data.category = body.category || null;

    if (body.status === "sold") {
      data.status = "sold";
      data.soldAt = new Date();
    } else if (body.status === "active") {
      data.status = "active";
      data.soldAt = null;
    }

    const item = await prisma.shopItem.update({
      where: { id },
      data,
    });

    revalidatePath("/shop");

    return NextResponse.json(item);
  } catch (err) {
    console.error("[shop/items PATCH]", err);
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }
}

// DELETE /api/shop/items/[id] — delete item (admin only)
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
    const item = await prisma.shopItem.findUnique({ where: { id } });
    if (!item) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Delete blob images
    for (const url of item.imageUrls) {
      try {
        await del(url);
      } catch {
        // Blob may already be deleted — continue
      }
    }

    await prisma.shopItem.delete({ where: { id } });

    revalidatePath("/shop");

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[shop/items DELETE]", err);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}
