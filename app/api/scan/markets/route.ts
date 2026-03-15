/**
 * POST /api/scan/markets/run — Trigger market intel collection cycle
 *
 * Calls the market worker's /collect/all + /analyze/signals endpoints.
 * Wraps the existing market-collect cron with scan logging.
 *
 * Auth: x-sync-secret or CRON_SECRET
 * Triggered by: DGX cron at 6:00 AM and 2:00 PM
 */

import { NextRequest, NextResponse } from "next/server";
import { logScanActivity, startScanRun, completeScanRun } from "@/lib/scan/log";

function checkAuth(req: NextRequest): boolean {
  const syncSecret = req.headers.get("x-sync-secret");
  if (syncSecret && syncSecret === process.env.SYNC_SECRET) return true;
  const authHeader = req.headers.get("authorization");
  if (authHeader && authHeader === `Bearer ${process.env.CRON_SECRET}`) return true;
  return false;
}

export async function POST(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const runId = await startScanRun("markets", { source: "auto-scan" });
  const workerUrl = process.env.MARKET_WORKER_URL || "http://localhost:8901";
  const syncSecret = process.env.SYNC_SECRET || "";
  const results: Record<string, unknown> = {};
  let hasError = false;

  try {
    await logScanActivity("markets", "Market intel collection triggered", {
      event: "scan_start",
      severity: "info",
    });

    // 1. Full collection (RSS, FRED, YouTube, stocks)
    try {
      const collectRes = await fetch(`${workerUrl}/collect/all`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-sync-secret": syncSecret },
        signal: AbortSignal.timeout(300000),
      });
      results.collection = await collectRes.json();
    } catch (e) {
      results.collection = { error: String(e) };
      hasError = true;
      await logScanActivity("markets", `Collection failed: ${e}`, { event: "error", severity: "warning" });
    }

    // 2. Signal generation (AI analysis)
    try {
      const signalRes = await fetch(`${workerUrl}/analyze/signals`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-sync-secret": syncSecret },
        signal: AbortSignal.timeout(120000),
      });
      results.signals = await signalRes.json();
    } catch (e) {
      results.signals = { error: String(e) };
      hasError = true;
      await logScanActivity("markets", `Signal analysis failed: ${e}`, { event: "error", severity: "warning" });
    }

    // 3. Push data to tolley.io (triggers snapshot + data point storage)
    try {
      const baseUrl = process.env.NEXTAUTH_URL || `https://${process.env.VERCEL_URL}` || "http://localhost:3000";
      const pushRes = await fetch(`${workerUrl}/push`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-sync-secret": syncSecret },
        body: JSON.stringify({ pushUrl: `${baseUrl}/api/markets/data/push` }),
        signal: AbortSignal.timeout(60000),
      });
      results.push = await pushRes.json();
    } catch (e) {
      results.push = { error: String(e) };
      // Not critical — data may have already been pushed during collect
    }

    await completeScanRun(runId, {
      itemsFound: 1,
      error: hasError ? "Partial failure" : undefined,
    });

    await logScanActivity("markets",
      hasError ? "Market intel collection completed with errors" : "Market intel collection complete",
      {
        event: "scan_complete",
        severity: hasError ? "warning" : "success",
        meta: results,
      }
    );

    return NextResponse.json({ ok: true, ...results });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await completeScanRun(runId, { error: msg });
    await logScanActivity("markets", `Market scan failed: ${msg}`, { event: "error", severity: "alert" });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
