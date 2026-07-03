import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateShopAdmin } from "@/lib/shop-auth";

export const runtime = "nodejs";

/**
 * Scan status. Returns the WhatsappScanJob row plus a rollup of the
 * BulkIngestJob rows it produced (once the scan has handed off a batchId) so
 * the UI can show one continuous progress bar: scrape → group → vision →
 * product → FB draft.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await validateShopAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  const scan = await prisma.whatsappScanJob.findUnique({ where: { id } });
  if (!scan) {
    return NextResponse.json({ error: "Scan not found" }, { status: 404 });
  }

  let items: Array<{
    id: string;
    status: string;
    title: string | null;
    thumbnail: string | null;
    productId: string | null;
    lastError: string | null;
  }> = [];

  if (scan.batchId) {
    const jobs = await prisma.bulkIngestJob.findMany({
      where: { batchId: scan.batchId },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        status: true,
        photoUrls: true,
        productId: true,
        visionResult: true,
        lastError: true,
      },
    });
    items = jobs.map((j) => {
      const v = j.visionResult as { title?: string } | null;
      return {
        id: j.id,
        status: j.status,
        title: v?.title ?? null,
        thumbnail: j.photoUrls[0] ?? null,
        productId: j.productId,
        lastError: j.lastError,
      };
    });
  }

  // "drafted" = BulkIngestJob created the Product and queued the FB draft.
  const drafted = items.filter((i) => i.status === "drafted").length;
  const failed = items.filter((i) => i.status === "failed").length;

  return NextResponse.json({
    scan: {
      id: scan.id,
      chatId: scan.chatId,
      chatName: scan.chatName,
      count: scan.count,
      status: scan.status,
      batchId: scan.batchId,
      photosFound: scan.photosFound,
      groups: scan.groups,
      skipped: scan.skipped,
      lastStage: scan.lastStage,
      lastError: scan.lastError,
      startedAt: scan.startedAt,
      completedAt: scan.completedAt,
      createdAt: scan.createdAt,
    },
    items,
    rollup: { total: items.length, drafted, failed },
  });
}
