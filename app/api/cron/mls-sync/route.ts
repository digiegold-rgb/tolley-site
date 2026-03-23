/**
 * Cron: MLS Grid incremental sync (every 4 hours).
 * Calls /api/leads/sync internally with SYNC_SECRET auth.
 */

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  const syncSecret = req.headers.get("x-sync-secret");

  const isVercelCron = cronSecret && authHeader === `Bearer ${cronSecret}`;
  const isManualTrigger = syncSecret && syncSecret === process.env.SYNC_SECRET;

  if (!isVercelCron && !isManualTrigger) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.MLS_GRID_TOKEN) {
    return NextResponse.json({ error: "MLS_GRID_TOKEN not configured" }, { status: 500 });
  }

  try {
    const syncUrl = new URL("/api/leads/sync?mode=incremental", req.url);
    const res = await fetch(syncUrl.toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-sync-secret": process.env.SYNC_SECRET || "",
      },
    });

    const result = await res.json();

    if (!res.ok) {
      console.error("[MLS Sync Cron] Sync failed:", result);
      return NextResponse.json(
        { error: "Sync failed", detail: result },
        { status: res.status }
      );
    }

    console.log(`[MLS Sync Cron] Complete: ${result.total} listings, ${result.leadsCreated} leads, ${result.autoResponded} auto-responded`);

    return NextResponse.json({
      message: "MLS sync cron complete",
      ...result,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Cron failed";
    console.error("[MLS Sync Cron]", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
