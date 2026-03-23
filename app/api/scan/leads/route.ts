/**
 * POST /api/scan/leads/run — Autonomous lead scanner (Phase 2 Enhanced)
 *
 * Sources:
 *   1. Regrid parcels — absentee/vacant off-market properties
 *   2. Expired/Withdrawn MLS — recently expired or withdrawn listings
 *   3. FSBO detection — Zillow FSBO + Craigslist RE via research worker
 *   4. Pre-foreclosure — tax delinquent parcels + county recorder data
 *
 * Pipeline:
 *   → Discover leads from all sources
 *   → Auto-create dossier jobs for hot parcels
 *   → Process queued dossier jobs
 *
 * Auth: x-sync-secret or CRON_SECRET
 * Triggered by: DGX cron nightly at 1:00 AM
 */

import { NextRequest, NextResponse } from "next/server";
import { logScanActivity, startScanRun, completeScanRun } from "@/lib/scan/log";
import {
  getFarmZips,
  runRegridScan,
  runExpiredMlsScan,
  runFsboScan,
  runPreForeclosureScan,
  queueAutoDossiers,
} from "@/lib/scan/leads";

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

  const url = new URL(req.url);
  const baseUrl = `${url.protocol}//${url.host}`;

  const runId = await startScanRun("leads", { source: "auto-scan-v2" });
  const errors: string[] = [];

  try {
    await logScanActivity("leads", "Enhanced lead scan started (4 sources)", {
      event: "scan_start",
      severity: "info",
    });

    // Source 1: Regrid parcel scan (also produces allZips for FSBO fallback)
    const allZips = await getFarmZips();
    const regrid = await runRegridScan(baseUrl, allZips);
    errors.push(...regrid.errors);

    // Source 2: Expired / Withdrawn MLS
    const expiredMls = await runExpiredMlsScan();
    errors.push(...expiredMls.errors);

    // Source 3: FSBO detection
    const fsbo = await runFsboScan(allZips);
    errors.push(...fsbo.errors);

    // Source 4: Pre-foreclosure / Tax delinquent
    const preForeclosure = await runPreForeclosureScan();
    errors.push(...preForeclosure.errors);

    // Auto-dossier: queue jobs for hot new parcels
    const autoDossier = await queueAutoDossiers();
    errors.push(...autoDossier.errors);

    // Process queued dossier jobs
    let dossiersProcessed = 0;
    try {
      const processRes = await fetch(
        `${baseUrl}/api/leads/dossier/process?limit=5`,
        {
          method: "POST",
          headers: { "x-sync-secret": process.env.SYNC_SECRET || "" },
          signal: AbortSignal.timeout(300000),
        }
      );
      const processResult = await processRes.json();
      dossiersProcessed = processResult.processed ?? 0;
    } catch (e) {
      errors.push(`Dossier processing: ${e}`);
    }

    const results = {
      regridScan: regrid.regridScan,
      newParcels: regrid.newParcels,
      expiredMlsLeads: expiredMls.expiredMlsLeads,
      fsboLeads: fsbo.fsboLeads,
      preForeclosureLeads: preForeclosure.preForeclosureLeads,
      dossiersCreated: autoDossier.dossiersCreated,
      dossiersProcessed,
      errors,
    };

    const totalItems =
      results.newParcels +
      results.expiredMlsLeads +
      results.fsboLeads +
      results.preForeclosureLeads;

    await completeScanRun(runId, {
      itemsFound: totalItems,
      alertsGen: results.dossiersCreated,
      error: errors.length > 0 ? errors.join("; ") : undefined,
    });

    const summary = [
      `${results.newParcels} parcels`,
      `${results.expiredMlsLeads} expired MLS`,
      `${results.fsboLeads} FSBO`,
      `${results.preForeclosureLeads} pre-foreclosure`,
      `${results.dossiersCreated} dossiers queued`,
    ].join(", ");

    await logScanActivity("leads", `Lead scan complete: ${summary}`, {
      event: "scan_complete",
      severity: totalItems > 0 ? "success" : "info",
      meta: results,
    });

    return NextResponse.json({ ok: true, ...results });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await completeScanRun(runId, { error: msg });
    await logScanActivity("leads", `Lead scan failed: ${msg}`, {
      event: "error",
      severity: "alert",
    });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
