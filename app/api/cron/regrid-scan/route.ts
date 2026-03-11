/**
 * Weekly cron: Regrid scan of subscriber farm areas.
 * Schedule: Monday 3am (vercel.json)
 *
 * Scans all unique zips/cities from active LeadSubscribers' farm areas.
 */

import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

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
      return NextResponse.json({ message: "No farm areas configured", scanned: 0 });
    }

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

    return NextResponse.json({
      message: "Weekly Regrid scan complete",
      subscriberCount: subscribers.length,
      zipsScanned: allZips.size,
      ...result,
    });
  } catch (err) {
    console.error("[Regrid Cron]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Cron failed" },
      { status: 500 }
    );
  }
}
