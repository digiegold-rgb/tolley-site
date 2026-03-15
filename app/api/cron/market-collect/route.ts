import { NextRequest, NextResponse } from "next/server";
import { logScanActivity, startScanRun, completeScanRun } from "@/lib/scan/log";

export const runtime = "nodejs";

/**
 * GET /api/cron/market-collect
 * Vercel cron trigger — calls worker /collect/all then /analyze/signals
 * Auth: CRON_SECRET (Vercel) or x-sync-secret
 */
export async function GET(request: NextRequest) {
  const cronOk =
    process.env.CRON_SECRET &&
    request.headers.get("authorization") === `Bearer ${process.env.CRON_SECRET}`;
  const syncOk =
    process.env.SYNC_SECRET &&
    request.headers.get("x-sync-secret") === process.env.SYNC_SECRET;

  if (!cronOk && !syncOk) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workerUrl = process.env.MARKET_WORKER_URL || "http://localhost:8901";
  const syncSecret = process.env.SYNC_SECRET || "";
  const results: Record<string, unknown> = {};

  const runId = await startScanRun("markets", { source: "market-collect-cron" });
  await logScanActivity("markets", "Market intel collection started", { event: "scan_start", severity: "info" });

  let hasError = false;

  // 1. Full collection
  try {
    const collectRes = await fetch(`${workerUrl}/collect/all`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-sync-secret": syncSecret,
      },
      signal: AbortSignal.timeout(300000), // 5 min
    });
    results.collection = await collectRes.json();
  } catch (e) {
    results.collection = { error: String(e) };
    hasError = true;
  }

  // 2. Signal generation
  try {
    const signalRes = await fetch(`${workerUrl}/analyze/signals`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-sync-secret": syncSecret,
      },
      signal: AbortSignal.timeout(120000), // 2 min
    });
    results.signals = await signalRes.json();
  } catch (e) {
    results.signals = { error: String(e) };
    hasError = true;
  }

  await completeScanRun(runId, { error: hasError ? "Partial failure" : undefined });
  await logScanActivity("markets", hasError ? "Market intel collection completed with errors" : "Market intel collection complete", {
    event: "scan_complete",
    severity: hasError ? "warning" : "success",
    meta: results,
  });

  return NextResponse.json({ ok: true, ...results });
}

export async function POST(request: NextRequest) {
  return GET(request);
}
