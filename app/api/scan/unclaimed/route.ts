/**
 * POST /api/scan/unclaimed/run — Autonomous unclaimed funds scanner (Phase 4)
 *
 * Expanded to 13 state sources + high-value alerting + claim pipeline stats.
 *
 * 1. Query leads + dossiers for unique owner names
 * 2. Filter out names already scanned in the last 30 days
 * 3. Batch dispatch unclaimed fund scans across all state sources
 * 4. Report on claim pipeline status + revenue attribution
 *
 * Auth: x-sync-secret or CRON_SECRET
 * Triggered by: DGX cron nightly at 1:30 AM
 */

import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logScanActivity, startScanRun, completeScanRun } from "@/lib/scan/log";

const MAX_SCANS_PER_RUN = 30;
const HIGH_VALUE_THRESHOLD = 500; // alert for finds > $500
const RESEARCH_WORKER_URL = process.env.RESEARCH_WORKER_URL || "http://localhost:8900";
const SYNC_SECRET = process.env.SYNC_SECRET || "";

// Expanded state sources — research worker handles the actual scraping
const ALL_SOURCES = [
  "mo_unclaimed",
  "mo_tax_surplus",
  "ks_unclaimed",
  "pa_unclaimed",
  "il_unclaimed",
  "oh_unclaimed",
  "in_unclaimed",
  "tx_unclaimed",
  "fl_unclaimed",
  "ca_unclaimed",
  "ny_unclaimed",
  "ga_unclaimed",
  "nc_unclaimed",
];

function checkAuth(req: NextRequest): boolean {
  const syncSecret = req.headers.get("x-sync-secret");
  if (syncSecret && syncSecret === process.env.SYNC_SECRET) return true;
  const authHeader = req.headers.get("authorization");
  if (authHeader && authHeader === `Bearer ${process.env.CRON_SECRET}`) return true;
  return false;
}

function getBaseUrl(req: NextRequest): string {
  const url = new URL(req.url);
  return `${url.protocol}//${url.host}`;
}

export async function POST(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const baseUrl = getBaseUrl(req);
  const runId = await startScanRun("unclaimed", { source: "auto-scan-v2" });
  const results = {
    namesChecked: 0,
    newScansDispatched: 0,
    alreadyScanned: 0,
    statesScanned: ALL_SOURCES.length,
    // Claim pipeline stats
    pipeline: {
      identified: 0,
      contacted: 0,
      agreementSigned: 0,
      filed: 0,
      approved: 0,
      paid: 0,
      totalClaimable: 0,
      totalPaid: 0,
    },
    // High-value finds from recent scans
    highValueFinds: [] as { name: string; amount: number; source: string }[],
    errors: [] as string[],
  };

  try {
    await logScanActivity("unclaimed", `Unclaimed scan started (${ALL_SOURCES.length} state sources)`, {
      event: "scan_start",
      severity: "info",
    });

    // ═══════════════════════════════════════════════════════
    // GATHER NAMES: leads + dossier results + parcel owners
    // ═══════════════════════════════════════════════════════
    const nameMap = new Map<string, { original: string; leadId: string }>();

    // From leads
    const leads = await prisma.lead.findMany({
      where: {
        ownerName: { not: null },
        status: { notIn: ["dead", "closed"] },
      },
      select: { id: true, ownerName: true },
      orderBy: { score: "desc" },
      take: 300,
    });

    for (const lead of leads) {
      if (!lead.ownerName) continue;
      const normalized = lead.ownerName.trim().toLowerCase();
      if (normalized.length < 3) continue;
      if (!nameMap.has(normalized)) {
        nameMap.set(normalized, { original: lead.ownerName.trim(), leadId: lead.id });
      }
    }

    // From dossier results
    const dossierResults = await prisma.dossierResult.findMany({
      where: { owners: { not: Prisma.JsonNull } },
      select: { owners: true },
      take: 200,
      orderBy: { createdAt: "desc" },
    });

    for (const dr of dossierResults) {
      if (dr.owners && Array.isArray(dr.owners)) {
        for (const owner of dr.owners as Array<{ name?: string }>) {
          if (owner.name) {
            const normalized = owner.name.trim().toLowerCase();
            if (normalized.length >= 3 && !nameMap.has(normalized)) {
              nameMap.set(normalized, { original: owner.name.trim(), leadId: "" });
            }
          }
        }
      }
    }

    // From parcel owners (absentee owners are great candidates)
    const parcelOwners = await prisma.parcel.findMany({
      where: {
        owner: { not: null },
        isAbsentee: true,
      },
      select: { owner: true },
      take: 200,
    });

    for (const p of parcelOwners) {
      if (!p.owner) continue;
      const normalized = p.owner.trim().toLowerCase();
      if (normalized.length >= 3 && !nameMap.has(normalized)) {
        nameMap.set(normalized, { original: p.owner.trim(), leadId: "" });
      }
    }

    results.namesChecked = nameMap.size;

    // ═══════════════════════════════════════════════════════
    // FILTER: Skip names scanned in last 30 days
    // ═══════════════════════════════════════════════════════
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const existingScans = await prisma.unclaimedFundScan.findMany({
      where: { createdAt: { gte: thirtyDaysAgo } },
      select: { ownerName: true },
    });
    const scannedNames = new Set(
      existingScans.map((s) => s.ownerName.trim().toLowerCase())
    );

    const unscannedNames: { original: string; leadId: string }[] = [];
    for (const [normalized, data] of nameMap) {
      if (scannedNames.has(normalized)) {
        results.alreadyScanned++;
      } else {
        unscannedNames.push(data);
      }
    }

    // ═══════════════════════════════════════════════════════
    // DISPATCH: Send scans to research worker
    // ═══════════════════════════════════════════════════════
    const toScan = unscannedNames.slice(0, MAX_SCANS_PER_RUN);
    const callbackUrl = `${baseUrl}/api/unclaimed/callback`;

    for (const { original: ownerName } of toScan) {
      try {
        const scan = await prisma.unclaimedFundScan.create({
          data: {
            userId: "system",
            ownerName,
            alternateNames: [],
            sources: ALL_SOURCES,
            status: "running",
          },
        });

        fetch(`${RESEARCH_WORKER_URL}/unclaimed-funds`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-sync-secret": SYNC_SECRET,
          },
          body: JSON.stringify({
            scanId: scan.id,
            ownerName,
            alternateNames: [],
            sources: ALL_SOURCES,
            callbackUrl,
          }),
        })
          .then(() => {
            console.log(`[scan/unclaimed] Dispatched "${ownerName}" → ${ALL_SOURCES.length} sources`);
          })
          .catch((e) => {
            prisma.unclaimedFundScan
              .update({
                where: { id: scan.id },
                data: { status: "failed", errorMessage: `Dispatch failed: ${e}` },
              })
              .catch(() => {});
          });

        results.newScansDispatched++;
      } catch (e) {
        results.errors.push(`Dispatch "${ownerName}": ${e}`);
      }
    }

    // ═══════════════════════════════════════════════════════
    // HIGH-VALUE ALERTING: Check recent scan results
    // ═══════════════════════════════════════════════════════
    const recentHighValue = await prisma.unclaimedFund.findMany({
      where: {
        amount: { gte: HIGH_VALUE_THRESHOLD },
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
      select: { ownerName: true, amount: true, source: true },
      orderBy: { amount: "desc" },
      take: 10,
    });

    for (const fund of recentHighValue) {
      results.highValueFinds.push({
        name: fund.ownerName,
        amount: fund.amount ?? 0,
        source: fund.source,
      });
    }

    if (recentHighValue.length > 0) {
      const totalHV = recentHighValue.reduce((sum, f) => sum + (f.amount ?? 0), 0);
      await logScanActivity("unclaimed", `HIGH VALUE: ${recentHighValue.length} finds over $${HIGH_VALUE_THRESHOLD} (total: $${totalHV.toFixed(0)})`, {
        event: "alert",
        severity: "alert",
        meta: { finds: results.highValueFinds },
      });
    }

    // ═══════════════════════════════════════════════════════
    // CLAIM PIPELINE: Status rollup + revenue tracking
    // ═══════════════════════════════════════════════════════
    const pipelineCounts = await prisma.unclaimedFundClaim.groupBy({
      by: ["status"],
      _count: { id: true },
      _sum: { claimAmount: true, actualPayout: true },
    });

    for (const row of pipelineCounts) {
      const count = row._count.id;
      switch (row.status) {
        case "identified": results.pipeline.identified = count; break;
        case "contacted": results.pipeline.contacted = count; break;
        case "agreement_signed": results.pipeline.agreementSigned = count; break;
        case "filed": results.pipeline.filed = count; break;
        case "approved": results.pipeline.approved = count; break;
        case "paid":
          results.pipeline.paid = count;
          results.pipeline.totalPaid = row._sum.actualPayout ?? 0;
          break;
      }
      results.pipeline.totalClaimable += row._sum.claimAmount ?? 0;
    }

    // Log revenue from paid claims to ScanRevenue
    if (results.pipeline.totalPaid > 0) {
      // Check if we already logged revenue today
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const alreadyLogged = await prisma.scanRevenue.findFirst({
        where: {
          scanner: "unclaimed",
          event: "claim_pipeline_total",
          createdAt: { gte: todayStart },
        },
      });

      if (!alreadyLogged) {
        await prisma.scanRevenue.create({
          data: {
            scanner: "unclaimed",
            event: "claim_pipeline_total",
            amount: results.pipeline.totalPaid,
            note: `Pipeline: ${results.pipeline.paid} claims paid`,
          },
        });
      }
    }

    // ═══════════════════════════════════════════════════════
    // COMPLETE
    // ═══════════════════════════════════════════════════════
    await completeScanRun(runId, {
      itemsFound: results.newScansDispatched,
      alertsGen: recentHighValue.length,
    });

    const summary = `${results.newScansDispatched} dispatched (${ALL_SOURCES.length} states), ${results.alreadyScanned} skipped, ${recentHighValue.length} high-value finds`;
    await logScanActivity("unclaimed", `Unclaimed scan complete: ${summary}`, {
      event: "scan_complete",
      severity: results.newScansDispatched > 0 ? "success" : "info",
      meta: results,
    });

    return NextResponse.json({ ok: true, ...results });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await completeScanRun(runId, { error: msg });
    await logScanActivity("unclaimed", `Unclaimed scan failed: ${msg}`, { event: "error", severity: "alert" });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
