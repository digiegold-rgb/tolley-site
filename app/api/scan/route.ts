/**
 * GET  /api/scan — Unified scan status (all 5 modules)
 * POST /api/scan — Log a scan activity event (cron/worker auth)
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { ScannerName } from "@/lib/scan/types";
import { SCANNER_CONFIG } from "@/lib/scan/types";

const VALID_SCANNERS: ScannerName[] = ["leads", "arbitrage", "products", "unclaimed", "markets"];

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "LOGIN_REQUIRED" }, { status: 401 });
  }

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const scanners = await Promise.all(
    VALID_SCANNERS.map(async (name) => {
      const [lastRun, todayCount] = await Promise.all([
        prisma.scanRun.findFirst({
          where: { scanner: name },
          orderBy: { startedAt: "desc" },
        }),
        prisma.scanRun.aggregate({
          _sum: { itemsFound: true },
          where: { scanner: name, startedAt: { gte: todayStart } },
        }),
      ]);

      return {
        name,
        label: SCANNER_CONFIG[name].label,
        status: lastRun?.status === "running" ? "running" : lastRun?.status === "failed" ? "error" : "idle",
        lastRun: lastRun?.startedAt.toISOString() ?? null,
        nextRun: SCANNER_CONFIG[name].schedule,
        todayCount: todayCount._sum.itemsFound ?? 0,
        error: lastRun?.error ?? null,
      };
    })
  );

  const [todayScanned, todayAlerts, todayRevenue] = await Promise.all([
    prisma.scanRun.aggregate({
      _sum: { itemsFound: true },
      where: { startedAt: { gte: todayStart } },
    }),
    prisma.scanActivity.count({
      where: { severity: { in: ["warning", "alert"] }, createdAt: { gte: todayStart } },
    }),
    prisma.scanRevenue.aggregate({
      _sum: { amount: true },
      where: { createdAt: { gte: todayStart } },
    }),
  ]);

  return NextResponse.json({
    scanners,
    todayStats: {
      totalScanned: todayScanned._sum.itemsFound ?? 0,
      totalAlerts: todayAlerts,
      totalRevenue: todayRevenue._sum.amount ?? 0,
    },
  });
}

export async function POST(req: NextRequest) {
  // Cron/worker auth
  const syncSecret = req.headers.get("x-sync-secret");
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  const isVercelCron = cronSecret && authHeader === `Bearer ${cronSecret}`;
  const isManualTrigger = syncSecret && syncSecret === process.env.SYNC_SECRET;

  if (!isVercelCron && !isManualTrigger) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { type, scanner, ...data } = body;

  if (!VALID_SCANNERS.includes(scanner)) {
    return NextResponse.json({ error: "Invalid scanner" }, { status: 400 });
  }

  if (type === "activity") {
    const activity = await prisma.scanActivity.create({
      data: {
        scanner,
        event: data.event || "info",
        title: data.title || "Activity logged",
        detail: data.detail || null,
        severity: data.severity || "info",
        meta: data.meta || null,
      },
    });
    return NextResponse.json({ ok: true, id: activity.id });
  }

  if (type === "run_start") {
    const run = await prisma.scanRun.create({
      data: {
        scanner,
        status: "running",
        meta: data.meta || null,
      },
    });
    return NextResponse.json({ ok: true, runId: run.id });
  }

  if (type === "run_complete") {
    if (!data.runId) {
      return NextResponse.json({ error: "runId required" }, { status: 400 });
    }
    const run = await prisma.scanRun.update({
      where: { id: data.runId },
      data: {
        status: data.error ? "failed" : "complete",
        itemsFound: data.itemsFound ?? 0,
        alertsGen: data.alertsGen ?? 0,
        duration: data.duration ?? null,
        error: data.error ?? null,
        completedAt: new Date(),
      },
    });
    return NextResponse.json({ ok: true, runId: run.id });
  }

  if (type === "revenue") {
    const rev = await prisma.scanRevenue.create({
      data: {
        scanner,
        event: data.event || "revenue",
        amount: data.amount || 0,
        sourceId: data.sourceId || null,
        note: data.note || null,
      },
    });
    return NextResponse.json({ ok: true, id: rev.id });
  }

  return NextResponse.json({ error: "Unknown type" }, { status: 400 });
}
