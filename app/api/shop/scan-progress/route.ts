import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateShopAdmin } from "@/lib/shop-auth";

export async function GET(req: NextRequest) {
  const isAdmin = await validateShopAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const runId = searchParams.get("runId");

  // Get latest scan run
  const latestRun = runId
    ? await prisma.scanRun.findUnique({ where: { id: runId } })
    : await prisma.scanRun.findFirst({
        where: { scanner: "arbitrage" },
        orderBy: { startedAt: "desc" },
      });

  if (!latestRun) {
    return NextResponse.json({ running: false, activities: [] });
  }

  // Get progress activities since the run started
  const activities = await prisma.scanActivity.findMany({
    where: {
      scanner: "arbitrage",
      event: "scan_progress",
      createdAt: { gte: latestRun.startedAt },
    },
    orderBy: { createdAt: "asc" },
  });

  // Parse phases from activities
  const phases = activities.map((a) => {
    const meta = a.meta as Record<string, unknown> | null;
    return {
      id: a.id,
      phase: (meta?.phase as string) || "unknown",
      message: a.title.replace("[TURBO] ", "").replace(/^[^:]+: /, ""),
      fullTitle: a.title,
      timestamp: a.createdAt.toISOString(),
      meta,
    };
  });

  const running = latestRun.status === "running";
  const completedPhase = phases.find((p) => p.phase === "COMPLETE");

  return NextResponse.json({
    running,
    runId: latestRun.id,
    startedAt: latestRun.startedAt.toISOString(),
    completedAt: latestRun.completedAt?.toISOString() || null,
    duration: latestRun.duration,
    status: latestRun.status,
    itemsFound: latestRun.itemsFound,
    alertsGen: latestRun.alertsGen,
    error: latestRun.error,
    phases,
    summary: completedPhase?.meta || null,
  });
}
