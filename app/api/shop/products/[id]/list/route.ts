import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateShopAdmin } from "@/lib/shop-auth";
import { computeNetAfterFees, computePlatformFees } from "@/lib/shop/fees";
import { revalidatePath } from "next/cache";
import type { Platform } from "@/lib/shop/types";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const isAdmin = await validateShopAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const { platforms } = body as {
    platforms: { platform: Platform; price: number; externalUrl?: string }[];
  };

  if (!platforms || !platforms.length) {
    return NextResponse.json({ error: "platforms[] required" }, { status: 400 });
  }

  const product = await prisma.product.findUnique({ where: { id } });
  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  const created = [];

  for (const p of platforms) {
    const fees = computePlatformFees(p.price, p.platform);
    const net = computeNetAfterFees(p.price, p.platform);

    const listing = await prisma.platformListing.upsert({
      where: { productId_platform: { productId: id, platform: p.platform } },
      create: {
        productId: id,
        platform: p.platform,
        price: p.price,
        platformFees: fees,
        netAfterFees: net,
        externalUrl: p.externalUrl || null,
        status: p.platform === "shop" ? "active" : "active",
        listedAt: new Date(),
      },
      update: {
        price: p.price,
        platformFees: fees,
        netAfterFees: net,
        externalUrl: p.externalUrl || null,
        status: "active",
        listedAt: new Date(),
        removedAt: null,
      },
    });
    created.push(listing);
  }

  // Update product status to listed if still draft
  if (product.status === "draft") {
    await prisma.product.update({
      where: { id },
      data: { status: "listed" },
    });
  }

  revalidatePath("/shop");
  return NextResponse.json({ listings: created });
}
