/**
 * POST /api/scan/unclaimed/run — Autonomous unclaimed funds scanner
 *
 * 1. Query leads for unique owner names
 * 2. Filter out names already scanned
 * 3. Batch dispatch unclaimed fund scans to research worker
 *
 * Auth: x-sync-secret or CRON_SECRET
 * Triggered by: DGX cron nightly at 1:30 AM
 */

import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logScanActivity, startScanRun, completeScanRun } from "@/lib/scan/log";

const MAX_SCANS_PER_RUN = 20;
const RESEARCH_WORKER_URL = process.env.RESEARCH_WORKER_URL || "http://localhost:8900";
const SYNC_SECRET = process.env.SYNC_SECRET || "";

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
  const runId = await startScanRun("unclaimed", { source: "auto-scan" });
  const results = {
    namesChecked: 0,
    newScansDispatched: 0,
    alreadyScanned: 0,
    errors: [] as string[],
  };

  try {
    await logScanActivity("unclaimed", "Autonomous unclaimed funds scan started", {
      event: "scan_start",
      severity: "info",
    });

    // ── Step 1: Get unique owner names from leads ──
    const leads = await prisma.lead.findMany({
      where: {
        ownerName: { not: null },
        status: { notIn: ["dead", "closed"] },
      },
      select: { id: true, ownerName: true },
      orderBy: { score: "desc" },
      take: 200,
    });

    // Deduplicate names (normalize: trim, lowercase for comparison)
    const nameMap = new Map<string, { original: string; leadId: string }>();
    for (const lead of leads) {
      if (!lead.ownerName) continue;
      const normalized = lead.ownerName.trim().toLowerCase();
      if (normalized.length < 3) continue;
      if (!nameMap.has(normalized)) {
        nameMap.set(normalized, { original: lead.ownerName.trim(), leadId: lead.id });
      }
    }

    // Also get names from recent dossier results (owner names from research)
    const dossierResults = await prisma.dossierResult.findMany({
      where: { owners: { not: Prisma.JsonNull } },
      select: { owners: true },
      take: 100,
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

    results.namesChecked = nameMap.size;

    // ── Step 2: Filter out names already scanned ──
    const existingScans = await prisma.unclaimedFundScan.findMany({
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

    // ── Step 3: Dispatch scans for new names ──
    const toScan = unscannedNames.slice(0, MAX_SCANS_PER_RUN);
    const callbackUrl = `${baseUrl}/api/unclaimed/callback`;

    for (const { original: ownerName } of toScan) {
      try {
        // Create scan record
        const scan = await prisma.unclaimedFundScan.create({
          data: {
            userId: "system", // system-initiated scan
            ownerName,
            alternateNames: [],
            sources: ["mo_unclaimed", "mo_tax_surplus", "ks_unclaimed"],
            status: "running",
          },
        });

        // Dispatch to research worker (fire-and-forget)
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
            sources: ["mo_unclaimed", "mo_tax_surplus", "ks_unclaimed"],
            callbackUrl,
          }),
        })
          .then(() => {
            console.log(`[scan/unclaimed] Dispatched scan for "${ownerName}" (${scan.id})`);
          })
          .catch((e) => {
            console.error(`[scan/unclaimed] Dispatch failed for "${ownerName}":`, e);
            prisma.unclaimedFundScan
              .update({
                where: { id: scan.id },
                data: { status: "failed", errorMessage: `Dispatch failed: ${e}` },
              })
              .catch(() => {});
          });

        results.newScansDispatched++;
      } catch (e) {
        results.errors.push(`Scan dispatch failed for "${ownerName}": ${e}`);
      }
    }

    // ── Complete ──
    await completeScanRun(runId, {
      itemsFound: results.newScansDispatched,
    });

    const summary = `Unclaimed scan: ${results.newScansDispatched} names dispatched, ${results.alreadyScanned} already scanned, ${results.namesChecked} total names`;
    await logScanActivity("unclaimed", summary, {
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
