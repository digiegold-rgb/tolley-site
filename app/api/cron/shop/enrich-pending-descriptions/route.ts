/**
 * Cron safety net for FB-backfill description enrichment.
 *
 * Why this exists: `after()` in /api/shop/fb-sync schedules the LLM enrich
 * pass for each batch we auto-create. But `after()` can be killed if the
 * function instance gets recycled, the LLM endpoint times out, etc. This
 * cron sweeps any backfill products still missing a `descriptionSource` and
 * runs the same enrichment pass — see lib/shop/ai-enrich.ts.
 *
 * Schedule: every 30 minutes (configure via vercel.json).
 *
 * Auth: Vercel cron sends `Authorization: Bearer ${CRON_SECRET}`. We accept
 * either that or an authenticated shop-admin cookie so an operator can hit
 * it manually from /shop/admin.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { enrichBackfilledProducts } from "@/lib/shop/ai-enrich";
import { validateShopAdmin } from "@/lib/shop-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const HARD_RUN_CAP = 50;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization") || "";
  const cronSecret = process.env.CRON_SECRET;
  const cronOk = Boolean(
    cronSecret && authHeader === `Bearer ${cronSecret}`
  );
  const adminOk = await validateShopAdmin().catch(() => false);

  if (!cronOk && !adminOk) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Find every distinct batchId that still has unenriched rows. Prisma's
  // `distinct` on a nullable field returns one row per unique value, which is
  // exactly what we want.
  const distinctBatches = await prisma.product.findMany({
    where: {
      fbBackfillBatchId: { not: null },
      descriptionSource: null,
    },
    select: { fbBackfillBatchId: true },
    distinct: ["fbBackfillBatchId"],
    take: 50,
  });

  const batches: Array<{
    batchId: string;
    enriched: number;
    failed: number;
    error?: string;
  }> = [];
  let totalEnriched = 0;
  let totalFailed = 0;
  let remaining = HARD_RUN_CAP;

  for (const row of distinctBatches) {
    const batchId = row.fbBackfillBatchId;
    if (!batchId) continue;
    if (remaining <= 0) break;

    const slice = Math.min(remaining, 50);
    try {
      const result = await enrichBackfilledProducts(batchId, {
        batchSize: 10,
        max: slice,
      });
      totalEnriched += result.enriched;
      totalFailed += result.failed;
      remaining -= result.enriched + result.failed;
      batches.push({ batchId, enriched: result.enriched, failed: result.failed });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      batches.push({ batchId, enriched: 0, failed: 0, error: msg });
      console.error(
        `[cron/enrich-pending-descriptions] batch=${batchId} crashed:`,
        msg
      );
    }
  }

  return NextResponse.json({
    ok: true,
    totalEnriched,
    totalFailed,
    runCap: HARD_RUN_CAP,
    batchCount: batches.length,
    batches,
    finishedAt: new Date().toISOString(),
  });
}
