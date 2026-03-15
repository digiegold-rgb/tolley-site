/**
 * POST /api/scan/leads/run — Autonomous lead scanner
 *
 * 1. Regrid scan across all subscriber farm zips
 * 2. Find new high-priority parcels with no dossier
 * 3. Auto-create dossier jobs for top parcels
 * 4. Process queued dossier jobs
 *
 * Auth: x-sync-secret or CRON_SECRET
 * Triggered by: DGX cron nightly at 1:00 AM
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logScanActivity, startScanRun, completeScanRun } from "@/lib/scan/log";

const MAX_AUTO_DOSSIERS = 10; // Max dossiers to auto-create per run

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

  const runId = await startScanRun("leads", { source: "auto-scan" });
  const results = {
    regridScan: null as Record<string, unknown> | null,
    newParcels: 0,
    dossiersCreated: 0,
    dossiersProcessed: 0,
    errors: [] as string[],
  };

  try {
    await logScanActivity("leads", "Autonomous lead scan started", {
      event: "scan_start",
      severity: "info",
    });

    // ── Step 1: Regrid scan across all subscriber farm zips ──
    const subscribers = await prisma.leadSubscriber.findMany({
      where: { status: "active" },
      select: { farmZips: true },
    });

    const allZips = new Set<string>();
    for (const sub of subscribers) {
      for (const zip of sub.farmZips) allZips.add(zip);
    }

    if (allZips.size > 0) {
      try {
        const baseUrl = process.env.NEXTAUTH_URL || `https://${process.env.VERCEL_URL}` || "http://localhost:3000";
        const scanRes = await fetch(`${baseUrl}/api/regrid/scan`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-sync-secret": process.env.SYNC_SECRET || "",
          },
          body: JSON.stringify({
            zips: [...allZips],
            filters: { absenteeOnly: false, vacantOnly: false },
          }),
          signal: AbortSignal.timeout(300000), // 5 min
        });
        results.regridScan = await scanRes.json();
        results.newParcels = (results.regridScan as Record<string, number>)?.newParcels ?? 0;

        if (results.newParcels > 0) {
          await logScanActivity("leads", `Regrid scan: ${results.newParcels} new parcels across ${allZips.size} zips`, {
            event: "discovery",
            severity: "success",
            meta: { zips: [...allZips], newParcels: results.newParcels },
          });
        }
      } catch (e) {
        const msg = `Regrid scan failed: ${e}`;
        results.errors.push(msg);
        await logScanActivity("leads", msg, { event: "error", severity: "warning" });
      }
    }

    // ── Step 2: Find high-priority parcels needing dossiers ──
    // Parcels created in last 24h with no dossier job, that are absentee or vacant
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const hotParcels = await prisma.parcel.findMany({
      where: {
        createdAt: { gte: oneDayAgo },
        OR: [
          { isAbsentee: true },
          { isVacant: true },
          { usps_vacancy: "Y" },
        ],
        // Must have an address to run a dossier
        address: { not: "" },
      },
      include: {
        leads: { select: { id: true } },
        listing: {
          select: {
            id: true,
            dossierJobs: { select: { id: true }, take: 1 },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    // Filter to parcels that don't already have a dossier job
    const needsDossier = hotParcels.filter((p) => {
      if (!p.listing) return false; // Need a linked listing for dossier
      return p.listing.dossierJobs.length === 0;
    });

    // ── Step 3: Auto-create dossier jobs for top parcels ──
    const toProcess = needsDossier.slice(0, MAX_AUTO_DOSSIERS);

    for (const parcel of toProcess) {
      try {
        await prisma.dossierJob.create({
          data: {
            listingId: parcel.listing!.id,
            leadId: parcel.leads[0]?.id ?? null,
            status: "queued",
            priority: 5, // Medium-high priority for auto-scans
            requestedBy: "auto-scan",
          },
        });
        results.dossiersCreated++;
      } catch (e) {
        results.errors.push(`Dossier create failed for parcel ${parcel.id}: ${e}`);
      }
    }

    // Also check for parcels without linked listings — create lightweight listings for them
    const parcelsNoListing = hotParcels
      .filter((p) => !p.listing && p.address)
      .slice(0, MAX_AUTO_DOSSIERS - results.dossiersCreated);

    for (const parcel of parcelsNoListing) {
      try {
        // Create a manual listing from parcel data
        const listing = await prisma.listing.create({
          data: {
            mlsId: `scan-${parcel.id}`,
            status: "Off-Market",
            address: parcel.address!,
            city: parcel.city ?? undefined,
            state: parcel.state ?? "MO",
            zip: parcel.zip ?? undefined,
            listPrice: parcel.parval ?? undefined,
            lat: parcel.lat ?? undefined,
            lng: parcel.lng ?? undefined,
            source: "scan",
            rawData: {
              parcelId: parcel.id,
              owner: parcel.owner,
              isAbsentee: parcel.isAbsentee,
              isVacant: parcel.isVacant,
            },
          },
        });

        // Link parcel to listing
        await prisma.parcel.update({
          where: { id: parcel.id },
          data: { listingId: listing.id },
        });

        // Create dossier job
        await prisma.dossierJob.create({
          data: {
            listingId: listing.id,
            leadId: parcel.leads[0]?.id ?? null,
            status: "queued",
            priority: 5,
            requestedBy: "auto-scan",
          },
        });
        results.dossiersCreated++;
      } catch (e) {
        results.errors.push(`Listing+dossier create failed for parcel ${parcel.id}: ${e}`);
      }
    }

    if (results.dossiersCreated > 0) {
      await logScanActivity("leads", `Auto-dossier: ${results.dossiersCreated} dossier jobs queued for hot parcels`, {
        event: "discovery",
        severity: "success",
        meta: { dossiersCreated: results.dossiersCreated },
      });
    }

    // ── Step 4: Process queued dossier jobs ──
    // Fire-and-forget: call the dossier process endpoint
    try {
      const baseUrl = process.env.NEXTAUTH_URL || `https://${process.env.VERCEL_URL}` || "http://localhost:3000";
      const processRes = await fetch(`${baseUrl}/api/leads/dossier/process?limit=5`, {
        method: "POST",
        headers: { "x-sync-secret": process.env.SYNC_SECRET || "" },
        signal: AbortSignal.timeout(300000),
      });
      const processResult = await processRes.json();
      results.dossiersProcessed = processResult.processed ?? 0;

      if (results.dossiersProcessed > 0) {
        await logScanActivity("leads", `Dossier pipeline: ${results.dossiersProcessed} jobs processed`, {
          event: "scan_complete",
          severity: "success",
        });
      }
    } catch (e) {
      results.errors.push(`Dossier processing failed: ${e}`);
    }

    // ── Complete ──
    const totalItems = results.newParcels + results.dossiersCreated;
    await completeScanRun(runId, {
      itemsFound: totalItems,
      alertsGen: results.dossiersCreated,
      error: results.errors.length > 0 ? results.errors.join("; ") : undefined,
    });

    await logScanActivity("leads", `Lead scan complete: ${results.newParcels} parcels, ${results.dossiersCreated} dossiers queued, ${results.dossiersProcessed} processed`, {
      event: "scan_complete",
      severity: totalItems > 0 ? "success" : "info",
      meta: results,
    });

    return NextResponse.json({ ok: true, ...results });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await completeScanRun(runId, { error: msg });
    await logScanActivity("leads", `Lead scan failed: ${msg}`, { event: "error", severity: "alert" });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
