import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateShopAdmin } from "@/lib/shop-auth";
import { computeNetAfterFees, computePlatformFees } from "@/lib/shop/fees";
import { revalidatePath } from "next/cache";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET() {
  const isAdmin = await validateShopAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [publishable, missingPrice, missingImage, orphans, visible] = await Promise.all([
    prisma.product.count({
      where: {
        status: "draft",
        imageUrls: { isEmpty: false },
        targetPrice: { gt: 0 },
      },
    }),
    prisma.product.count({
      where: {
        status: "draft",
        imageUrls: { isEmpty: false },
        OR: [{ targetPrice: null }, { targetPrice: { lte: 0 } }],
      },
    }),
    prisma.product.count({
      where: { status: "draft", imageUrls: { isEmpty: true } },
    }),
    prisma.product.count({
      where: {
        status: "listed",
        targetPrice: { gt: 0 },
        NOT: { listings: { some: { platform: "shop", status: "active" } } },
      },
    }),
    prisma.product.count({
      where: {
        status: "listed",
        listings: { some: { platform: "shop", status: "active" } },
      },
    }),
  ]);

  return NextResponse.json({ publishable, missingPrice, missingImage, orphans, visible });
}

export async function POST() {
  const isAdmin = await validateShopAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const drafts = await prisma.product.findMany({
    where: {
      status: "draft",
      imageUrls: { isEmpty: false },
      targetPrice: { gt: 0 },
    },
    select: { id: true, targetPrice: true },
  });

  const orphans = await prisma.product.findMany({
    where: {
      status: "listed",
      targetPrice: { gt: 0 },
      NOT: { listings: { some: { platform: "shop", status: "active" } } },
    },
    select: { id: true, targetPrice: true },
  });

  let published = 0;
  let healed = 0;

  for (const d of drafts) {
    const price = d.targetPrice!;
    const fees = computePlatformFees(price, "shop");
    const net = computeNetAfterFees(price, "shop");
    await prisma.platformListing.upsert({
      where: { productId_platform: { productId: d.id, platform: "shop" } },
      create: {
        productId: d.id,
        platform: "shop",
        price,
        platformFees: fees,
        netAfterFees: net,
        status: "active",
        listedAt: new Date(),
      },
      update: {
        price,
        platformFees: fees,
        netAfterFees: net,
        status: "active",
        listedAt: new Date(),
        removedAt: null,
      },
    });
    await prisma.product.update({
      where: { id: d.id },
      data: { status: "listed" },
    });
    published++;
  }

  for (const o of orphans) {
    const price = o.targetPrice!;
    const fees = computePlatformFees(price, "shop");
    const net = computeNetAfterFees(price, "shop");
    await prisma.platformListing.upsert({
      where: { productId_platform: { productId: o.id, platform: "shop" } },
      create: {
        productId: o.id,
        platform: "shop",
        price,
        platformFees: fees,
        netAfterFees: net,
        status: "active",
        listedAt: new Date(),
      },
      update: {
        status: "active",
        removedAt: null,
        listedAt: new Date(),
      },
    });
    healed++;
  }

  if (published || healed) {
    revalidatePath("/shop");
  }

  return NextResponse.json({ ok: true, published, healed });
}
