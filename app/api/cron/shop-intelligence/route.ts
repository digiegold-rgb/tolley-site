/**
 * POST /api/cron/shop-intelligence — Twice daily shop intelligence cron
 *
 * Schedule: 0 3,15 * * * (3 AM and 3 PM)
 *
 * 1. Capture price snapshots for active products
 * 2. Trend analysis via research worker
 * 3. Margin monitoring — alert if below threshold
 * 4. Stale inventory flagging (30+ days)
 * 5. Lot P&L recomputation
 */

import { NextRequest, NextResponse } from "next/server";
import { runShopIntelligence } from "@/lib/shop/intelligence";
import { validateShopAdmin } from "@/lib/shop-auth";
import { logScanActivity, startScanRun, completeScanRun } from "@/lib/scan/log";

export const maxDuration = 120;

async function checkAuth(req: NextRequest): Promise<boolean> {
  const syncSecret = req.headers.get("x-sync-secret");
  if (syncSecret && syncSecret === process.env.SYNC_SECRET) return true;
  const authHeader = req.headers.get("authorization");
  if (authHeader && authHeader === `Bearer ${process.env.CRON_SECRET}`) return true;
  // Allow dashboard admin to trigger manually
  const isAdmin = await validateShopAdmin();
  if (isAdmin) return true;
  return false;
}

export async function POST(req: NextRequest) {
  if (!(await checkAuth(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const runId = await startScanRun("arbitrage", { source: "shop-intelligence" });

  try {
    await logScanActivity("arbitrage", "Shop intelligence cron started", {
      event: "scan_start",
      severity: "info",
    });

    const result = await runShopIntelligence();

    await completeScanRun(runId, {
      itemsFound: result.snapshotsCaptured + result.trendsCreated,
      alertsGen: result.marginAlerts + result.staleItems,
      error: result.errors.length > 0 ? result.errors.join("; ") : undefined,
    });

    const summary = `Sources: ${result.sourcesScanned}, Snapshots: ${result.snapshotsCaptured}, Trends: ${result.trendsCreated}, Stale: ${result.staleItems}, Margin alerts: ${result.marginAlerts}, Lots: ${result.lotsUpdated}`;
    await logScanActivity("arbitrage", `Shop intelligence complete: ${summary}`, {
      event: "scan_complete",
      severity: result.marginAlerts > 0 || result.staleItems > 5 ? "warning" : "success",
      meta: result as unknown as Record<string, unknown>,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await completeScanRun(runId, { error: msg });
    await logScanActivity("arbitrage", `Shop intelligence failed: ${msg}`, {
      event: "error",
      severity: "alert",
    });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
