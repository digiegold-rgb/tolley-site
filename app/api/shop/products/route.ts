import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { validateShopAdmin } from "@/lib/shop-auth";
import { secretEquals } from "@/lib/secret-compare";
import { revalidatePath } from "next/cache";
import { enqueueAllReadyDrafts } from "@/lib/shop/queue";
import { parseSearchQuery, tokenizeSearchQuery } from "@/lib/shop/filters";

export async function GET(req: NextRequest) {
  // Internal inventory (costBasis, sourcing, listing jobs) — admin cookie or
  // x-sync-secret (DGX pipelines). Flagged public in the 3/22 audit; fixed 7/23.
  const secret = req.headers.get("x-sync-secret");
  const machineOk = Boolean(secret && secretEquals(secret, process.env.SYNC_SECRET));
  if (!machineOk && !(await validateShopAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") || "listed";
  const category = searchParams.get("category");
  const platform = searchParams.get("platform");
  const lotId = searchParams.get("lotId");
  const q = parseSearchQuery(searchParams.get("q"));
  const limit = parseInt(searchParams.get("limit") || "100", 10);
  const offset = parseInt(searchParams.get("offset") || "0", 10);

  const where: Prisma.ProductWhereInput = {};
  if (status !== "all") where.status = status;
  if (category) where.category = category;
  if (lotId) where.lotId = lotId;
  if (platform) {
    where.listings = { some: { platform, status: { not: "removed" } } };
  }
  if (q) {
    const tokens = tokenizeSearchQuery(q);
    if (tokens.length > 0) {
      where.AND = tokens.map((tok) => ({
        OR: [
          { title: { contains: tok, mode: "insensitive" } },
          { description: { contains: tok, mode: "insensitive" } },
          { brand: { contains: tok, mode: "insensitive" } },
          { category: { contains: tok, mode: "insensitive" } },
        ],
      }));
    }
  }

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      include: {
        listings: true,
        listingJobs: {
          where: { platform: "fb_marketplace" },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            id: true,
            status: true,
            attempts: true,
            lastError: true,
            lastStage: true,
            nextAttemptAt: true,
            completedAt: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.product.count({ where }),
  ]);

  return NextResponse.json({ products, total });
}

export async function POST(req: NextRequest) {
  const isAdmin = await validateShopAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const {
    title, description, category, subcategory, brand, condition,
    sku, upc, imageUrls, sourcingType, sourcingVendor, lotId,
    costBasis, shippingCost, targetPrice, minPrice, status,
  } = body;

  if (!title) {
    return NextResponse.json({ error: "title required" }, { status: 400 });
  }

  const totalCogs = (costBasis || 0) + (shippingCost || 0) || null;

  const product = await prisma.product.create({
    data: {
      title,
      description: description || null,
      category: category || null,
      subcategory: subcategory || null,
      brand: brand || null,
      condition: condition || null,
      sku: sku || null,
      upc: upc || null,
      imageUrls: imageUrls || [],
      sourcingType: sourcingType || null,
      sourcingVendor: sourcingVendor || null,
      lotId: lotId || null,
      costBasis: costBasis || null,
      shippingCost: shippingCost || null,
      totalCogs,
      targetPrice: targetPrice || null,
      minPrice: minPrice || null,
      status: status || "draft",
    },
    include: { listings: true },
  });

  // Enqueue parallel drafts on every platform that's ready (FB always,
  // eBay only when OAuth + business policies + location are configured).
  // The workers drain the queue autonomously.
  let queued: Awaited<ReturnType<typeof enqueueAllReadyDrafts>> = [];
  if (product.imageUrls.length > 0 && (product.targetPrice || product.minPrice)) {
    try {
      queued = await enqueueAllReadyDrafts(product.id);
    } catch (err) {
      console.error(`[shop/products] enqueue failed for ${product.id}:`, err);
    }
  }

  revalidatePath("/shop");
  return NextResponse.json({ ...product, queued }, { status: 201 });
}
