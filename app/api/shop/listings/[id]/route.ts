import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateShopAdmin } from "@/lib/shop-auth";
import { revalidatePath } from "next/cache";

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

  // Auto-set timestamps based on status changes
  if (body.status === "sold" && !body.soldAt) body.soldAt = new Date();
  if (body.status === "removed" && !body.removedAt) body.removedAt = new Date();
  if (body.status === "active" && !body.listedAt) body.listedAt = new Date();

  const listing = await prisma.platformListing.update({
    where: { id },
    data: body,
    include: { product: true },
  });

  revalidatePath("/shop");
  return NextResponse.json(listing);
}
