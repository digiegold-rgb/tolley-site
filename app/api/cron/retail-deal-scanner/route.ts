/**
 * POST /api/cron/retail-deal-scanner — daily retail arbitrage deal scan.
 *
 * Scans big-box retailer inventory (Home Depot by default; Lowe's/Walmart when
 * DEAL_RETAILERS is widened), scores resale margin vs eBay sold comps, upserts
 * RetailDeal rows, and fans high-margin finds out to /api/routines/inbox.
 *
 * Auth: x-sync-secret OR Bearer CRON_SECRET OR shop admin session (manual run).
 */

import { NextRequest, NextResponse } from "next/server";
import { runDealScan } from "@/lib/shop/deal-scanner";
import { validateShopAdmin } from "@/lib/shop-auth";
import { logScanActivity, startScanRun, completeScanRun } from "@/lib/scan/log";

export const runtime = "nodejs";
export const maxDuration = 300;

async function checkAuth(req: NextRequest): Promise<boolean> {
  const syncSecret = req.headers.get("x-sync-secret");
  if (syncSecret && syncSecret === process.env.SYNC_SECRET) return true;
  const authHeader = req.headers.get("authorization");
  if (authHeader && authHeader === `Bearer ${process.env.CRON_SECRET}`) return true;
  return (await validateShopAdmin()) === true;
}

async function run(req: NextRequest) {
  if (!(await checkAuth(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const runId = await startScanRun("arbitrage", { source: "retail-deal-scanner" });
  try {
    await logScanActivity("arbitrage", "Retail deal scan started", {
      event: "scan_start",
      severity: "info",
    });

    const result = await runDealScan();

    await completeScanRun(runId, {
      itemsFound: result.finds,
      alertsGen: result.alerts,
      error: result.errors.length > 0 ? result.errors.slice(0, 5).join("; ") : undefined,
    });

    const summary = `Retailers: ${result.retailers.join("/")}, Queries: ${result.queriesRun}, Seen: ${result.productsSeen}, Enriched: ${result.enriched}, Finds: ${result.finds}, Comped: ${result.comped}, Alerts: ${result.alerts}`;
    await logScanActivity("arbitrage", `Retail deal scan complete: ${summary}`, {
      event: "scan_complete",
      severity: result.alerts > 0 ? "warning" : "success",
      meta: result as unknown as Record<string, unknown>,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await completeScanRun(runId, { error: msg });
    await logScanActivity("arbitrage", `Retail deal scan failed: ${msg}`, {
      event: "error",
      severity: "alert",
    });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  return run(req);
}

// Vercel cron invokes via GET; support both.
export async function GET(req: NextRequest) {
  return run(req);
}
