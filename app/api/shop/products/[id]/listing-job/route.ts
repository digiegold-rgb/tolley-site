import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateShopAdmin } from "@/lib/shop-auth";
import { enqueueAllReadyDrafts } from "@/lib/shop/queue";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const isAdmin = await validateShopAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const job = await prisma.listingJob.findFirst({
    where: { productId: id, platform: "fb_marketplace" },
    orderBy: { createdAt: "desc" },
  });
  if (!job) {
    return NextResponse.json({ job: null });
  }
  return NextResponse.json({
    job: {
      id: job.id,
      status: job.status,
      attempts: job.attempts,
      lastError: job.lastError,
      lastStage: job.lastStage,
      nextAttemptAt: job.nextAttemptAt,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      createdAt: job.createdAt,
    },
  });
}

// POST /api/shop/products/[id]/listing-job — manually (re)enqueue
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const isAdmin = await validateShopAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const product = await prisma.product.findUnique({ where: { id } });
  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }
  if (!product.imageUrls || product.imageUrls.length === 0) {
    return NextResponse.json({ error: "Product has no images" }, { status: 400 });
  }
  if (!product.targetPrice && !product.minPrice) {
    return NextResponse.json({ error: "Product has no price" }, { status: 400 });
  }
  const results = await enqueueAllReadyDrafts(id);
  return NextResponse.json({ enqueued: results });
}
