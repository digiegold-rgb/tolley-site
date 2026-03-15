/**
 * Weekly cron: Regrid scan of subscriber farm areas.
 * Schedule: Monday 3am (vercel.json)
 *
 * Scans all unique zips/cities from active LeadSubscribers' farm areas.
 */

import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { logScanActivity, startScanRun, completeScanRun } from "@/lib/scan/log";

const prisma = new PrismaClient();

export async function GET(req: NextRequest) {
  // Vercel cron auth (or manual trigger with sync secret)
  const authHeader = req.headers.get("authorization");
  const syncSecret = req.headers.get("x-sync-secret");
  const cronSecret = process.env.CRON_SECRET;

  const isVercelCron = cronSecret && authHeader === `Bearer ${cronSecret}`;
  const isManualTrigger = syncSecret && syncSecret === process.env.SYNC_SECRET;

  if (!isVercelCron && !isManualTrigger) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.REGRID_API_TOKEN) {
    return NextResponse.json({ error: "REGRID_API_TOKEN not configured" }, { status: 500 });
  }

  const runId = await startScanRun("leads", { source: "regrid-cron" });

  try {
    // Collect all unique farm zips from active subscribers
    const subscribers = await prisma.leadSubscriber.findMany({
      where: { status: "active" },
      select: { farmZips: true, farmCities: true },
    });

    const allZips = new Set<string>();
    for (const sub of subscribers) {
      for (const zip of sub.farmZips) allZips.add(zip);
    }

    if (allZips.size === 0) {
      await completeScanRun(runId, { itemsFound: 0 });
      await logScanActivity("leads", "Regrid scan: no farm areas configured", { event: "scan_complete", severity: "info" });
      return NextResponse.json({ message: "No farm areas configured", scanned: 0 });
    }

    await logScanActivity("leads", `Regrid scan started: ${allZips.size} zips, ${subscribers.length} subscribers`, { event: "scan_start", severity: "info" });

    // Call our scan endpoint internally
    const scanUrl = new URL("/api/regrid/scan", req.url);
    const res = await fetch(scanUrl.toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-sync-secret": process.env.SYNC_SECRET || "",
      },
      body: JSON.stringify({
        zips: [...allZips],
        filters: { absenteeOnly: false, vacantOnly: false },
      }),
    });

    const result = await res.json();
    const itemsFound = result.parcelsFound ?? result.created ?? 0;

    await completeScanRun(runId, { itemsFound });
    await logScanActivity("leads", `Regrid scan complete: ${itemsFound} parcels found across ${allZips.size} zips`, {
      event: "scan_complete",
      severity: itemsFound > 0 ? "success" : "info",
      meta: { zipsScanned: allZips.size, subscriberCount: subscribers.length, ...result },
    });

    return NextResponse.json({
      message: "Weekly Regrid scan complete",
      subscriberCount: subscribers.length,
      zipsScanned: allZips.size,
      ...result,
    });
  } catch (err) {
    console.error("[Regrid Cron]", err);
    const errMsg = err instanceof Error ? err.message : "Cron failed";
    await completeScanRun(runId, { error: errMsg });
    await logScanActivity("leads", `Regrid scan failed: ${errMsg}`, { event: "error", severity: "alert" });
    return NextResponse.json(
      { error: errMsg },
      { status: 500 }
    );
  }
}
