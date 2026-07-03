import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

// GET /api/pools/sync-log — last 14 days of Pool360 sync runs + activity
export async function GET() {
  const since = new Date();
  since.setDate(since.getDate() - 14);

  const [syncRuns, auditRuns, activity] = await Promise.all([
    // Pool360 scraper syncs (source: pool360-sync)
    prisma.scanRun.findMany({
      where: {
        scanner: "products",
        startedAt: { gte: since },
        meta: { path: ["source"], equals: "pool360-sync" },
      },
      orderBy: { startedAt: "desc" },
      take: 30,
    }),
    // Stock audit runs (source: auto-scan) — show separately
    prisma.scanRun.findMany({
      where: {
        scanner: "products",
        startedAt: { gte: since },
        meta: { path: ["source"], equals: "auto-scan" },
      },
      orderBy: { startedAt: "desc" },
      take: 30,
    }),
    prisma.scanActivity.findMany({
      where: { scanner: "products", createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ]);

  return NextResponse.json({ runs: syncRuns, auditRuns, activity });
}
