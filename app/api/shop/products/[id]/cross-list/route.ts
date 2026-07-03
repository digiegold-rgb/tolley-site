/**
 * Manual cross-list trigger.
 *
 * POST { platforms?: DraftPlatform[] }
 *
 * - With `platforms` → enqueue draft jobs for exactly those platforms.
 *   Each one is silently dropped if not currently ready (sessionState !==
 *   "connected"). Returns the resolved list so the UI can show what was
 *   actually queued.
 * - Without `platforms` → fan out to every ready platform via
 *   enqueueAllReadyDrafts (the same code path used at product creation).
 *
 * This is the replacement for the old clipboard-Vendoo button — the listing
 * jobs land in `ListingJob`, drainers on the DGX claim them, and the
 * mirror pollers will reconcile state back into PlatformListing.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateShopAdmin } from "@/lib/shop-auth";
import {
  ALL_DRAFT_PLATFORMS,
  enqueueAllReadyDrafts,
  enqueueDrafts,
  readyPlatforms,
  type DraftPlatform,
} from "@/lib/shop/queue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const isAdmin = await validateShopAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const product = await prisma.product.findUnique({
    where: { id },
    select: { id: true, title: true, imageUrls: true, targetPrice: true },
  });
  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }
  if (!product.imageUrls.length) {
    return NextResponse.json(
      { error: "Product has no photos — cannot list" },
      { status: 400 }
    );
  }
  if (!product.targetPrice || product.targetPrice <= 0) {
    return NextResponse.json(
      { error: "Product has no targetPrice — cannot list" },
      { status: 400 }
    );
  }

  let body: { platforms?: string[] } = {};
  try {
    body = (await req.json().catch(() => ({}))) as { platforms?: string[] };
  } catch {
    body = {};
  }

  const ready = await readyPlatforms();

  if (Array.isArray(body.platforms) && body.platforms.length > 0) {
    const requested = body.platforms.filter((p): p is DraftPlatform =>
      (ALL_DRAFT_PLATFORMS as string[]).includes(p)
    );
    const allowed = requested.filter((p) => ready.includes(p));
    const skipped = requested.filter((p) => !ready.includes(p));
    if (allowed.length === 0) {
      return NextResponse.json(
        {
          error: "No requested platforms are currently connected",
          requested,
          ready,
        },
        { status: 400 }
      );
    }
    const results = await enqueueDrafts(id, allowed);
    return NextResponse.json({
      ok: true,
      productId: id,
      enqueued: results,
      skipped,
      ready,
    });
  }

  const results = await enqueueAllReadyDrafts(id);
  return NextResponse.json({ ok: true, productId: id, enqueued: results, ready });
}

/**
 * GET → return the latest job per platform for this product, plus the
 * current ready-platforms list. Used by the InventoryTable + EditProductModal
 * to render per-platform badges without 5× separate round-trips.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const isAdmin = await validateShopAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const [jobs, listings, ready] = await Promise.all([
    prisma.listingJob.findMany({
      where: { productId: id },
      orderBy: { createdAt: "desc" },
    }),
    prisma.platformListing.findMany({
      where: { productId: id },
    }),
    readyPlatforms(),
  ]);

  // Reduce to latest job per (platform, intent).
  const latestJob = new Map<string, (typeof jobs)[number]>();
  for (const j of jobs) {
    const key = `${j.platform}:${j.intent}`;
    if (!latestJob.has(key)) latestJob.set(key, j);
  }

  return NextResponse.json({
    productId: id,
    ready,
    jobs: Array.from(latestJob.values()),
    listings,
  });
}
