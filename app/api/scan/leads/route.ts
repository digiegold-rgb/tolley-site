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
import { prisma } from "@/lib/prisma";
import { logScanActivity, startScanRun, completeScanRun } from "@/lib/scan/log";

const MAX_AUTO_DOSSIERS = 15;
const RESEARCH_WORKER_URL = process.env.RESEARCH_WORKER_URL || "http://localhost:8900";

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
  const runId = await startScanRun("leads", { source: "auto-scan-v2" });
  const results = {
    regridScan: null as Record<string, unknown> | null,
    newParcels: 0,
    expiredMlsLeads: 0,
    fsboLeads: 0,
    preForeclosureLeads: 0,
    dossiersCreated: 0,
    dossiersProcessed: 0,
    errors: [] as string[],
  };

  try {
    await logScanActivity("leads", "Enhanced lead scan started (4 sources)", {
      event: "scan_start",
      severity: "info",
    });

    // ═══════════════════════════════════════════════════════
    // SOURCE 1: Regrid parcel scan
    // ═══════════════════════════════════════════════════════
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
          signal: AbortSignal.timeout(300000),
        });
        results.regridScan = await scanRes.json();
        results.newParcels = (results.regridScan as Record<string, number>)?.newParcels ?? 0;

        if (results.newParcels > 0) {
          await logScanActivity("leads", `Regrid: ${results.newParcels} new parcels across ${allZips.size} zips`, {
            event: "discovery",
            severity: "success",
            meta: { zips: [...allZips], newParcels: results.newParcels },
          });
        }
      } catch (e) {
        results.errors.push(`Regrid: ${e}`);
      }
    }

    // ═══════════════════════════════════════════════════════
    // SOURCE 2: Expired / Withdrawn MLS listings
    // ═══════════════════════════════════════════════════════
    try {
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

      // Find recently expired/withdrawn listings with no lead
      const expiredListings = await prisma.listing.findMany({
        where: {
          status: { in: ["Expired", "Withdrawn"] },
          updatedAt: { gte: threeDaysAgo },
          leads: { none: {} },
        },
        select: {
          id: true,
          status: true,
          address: true,
          city: true,
          state: true,
          zip: true,
          listPrice: true,
          daysOnMarket: true,
          listAgentName: true,
        },
        take: 50,
      });

      for (const listing of expiredListings) {
        try {
          const source = listing.daysOnMarket && listing.daysOnMarket > 90
            ? "mls_dom"
            : "mls_expired";

          // Score: higher for longer DOM, higher price
          let score = 40; // base for expired
          if (listing.daysOnMarket && listing.daysOnMarket > 60) score += 15;
          if (listing.daysOnMarket && listing.daysOnMarket > 120) score += 10;
          if (listing.listPrice && listing.listPrice > 200000) score += 5;

          await prisma.lead.create({
            data: {
              listingId: listing.id,
              score: Math.min(score, 100),
              scoreFactors: {
                expired: true,
                daysOnMarket: listing.daysOnMarket ?? 0,
                listPrice: listing.listPrice ?? 0,
              },
              status: "new",
              source,
              notes: `Auto-detected: ${listing.status} listing at ${listing.address}. DOM: ${listing.daysOnMarket ?? "?"}. Listed by: ${listing.listAgentName ?? "unknown"}.`,
            },
          });
          results.expiredMlsLeads++;
        } catch {
          // Likely duplicate — skip silently
        }
      }

      if (results.expiredMlsLeads > 0) {
        await logScanActivity("leads", `Expired MLS: ${results.expiredMlsLeads} new leads from expired/withdrawn listings`, {
          event: "discovery",
          severity: "success",
          meta: { count: results.expiredMlsLeads },
        });
      }
    } catch (e) {
      results.errors.push(`Expired MLS: ${e}`);
    }

    // ═══════════════════════════════════════════════════════
    // SOURCE 3: FSBO detection via research worker
    // ═══════════════════════════════════════════════════════
    try {
      // Get farm cities for FSBO search
      const farmCities = new Set<string>();
      const subs = await prisma.leadSubscriber.findMany({
        where: { status: "active" },
        select: { farmCities: true, farmZips: true },
      });
      for (const sub of subs) {
        for (const city of sub.farmCities) farmCities.add(city);
      }

      // If no farm cities configured, use zips to derive cities from existing data
      if (farmCities.size === 0 && allZips.size > 0) {
        const zipCities = await prisma.listing.findMany({
          where: { zip: { in: [...allZips] }, city: { not: null } },
          select: { city: true },
          distinct: ["city"],
          take: 10,
        });
        for (const l of zipCities) {
          if (l.city) farmCities.add(l.city);
        }
      }

      if (farmCities.size > 0) {
        // Call research worker for FSBO scraping
        for (const city of [...farmCities].slice(0, 5)) {
          try {
            const fsboRes = await fetch(`${RESEARCH_WORKER_URL}/scrape/fsbo`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-sync-secret": process.env.SYNC_SECRET || "",
              },
              body: JSON.stringify({
                city,
                state: "MO",
                sources: ["zillow_fsbo", "craigslist_re"],
              }),
              signal: AbortSignal.timeout(60000),
            });

            if (fsboRes.ok) {
              const fsboData = await fsboRes.json();
              const listings = fsboData.listings || [];

              for (const fsbo of listings) {
                if (!fsbo.address) continue;
                try {
                  // Check for existing listing at this address
                  const existing = await prisma.listing.findFirst({
                    where: { address: { contains: fsbo.address, mode: "insensitive" } },
                  });
                  if (existing) continue;

                  // Create listing + lead
                  const listing = await prisma.listing.create({
                    data: {
                      mlsId: `fsbo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                      status: "FSBO",
                      address: fsbo.address,
                      city: fsbo.city || city,
                      state: fsbo.state || "MO",
                      zip: fsbo.zip || null,
                      listPrice: fsbo.price || null,
                      beds: fsbo.beds || null,
                      baths: fsbo.baths || null,
                      sqft: fsbo.sqft || null,
                      listingUrl: fsbo.url || null,
                      source: "fsbo",
                      rawData: fsbo,
                    },
                  });

                  await prisma.lead.create({
                    data: {
                      listingId: listing.id,
                      score: 55, // FSBO = motivated seller
                      scoreFactors: { fsbo: true, source: fsbo.source || "unknown" },
                      status: "new",
                      source: "fsbo",
                      ownerName: fsbo.ownerName || null,
                      ownerPhone: fsbo.phone || null,
                      notes: `FSBO listing found on ${fsbo.source || "web"}. Price: $${fsbo.price || "?"}`,
                    },
                  });
                  results.fsboLeads++;
                } catch {
                  // Duplicate or invalid — skip
                }
              }
            }
          } catch {
            // Research worker FSBO endpoint may not exist yet — not an error
          }
        }

        if (results.fsboLeads > 0) {
          await logScanActivity("leads", `FSBO: ${results.fsboLeads} new leads from FSBO listings`, {
            event: "discovery",
            severity: "success",
            meta: { count: results.fsboLeads, cities: [...farmCities].slice(0, 5) },
          });
        }
      }
    } catch (e) {
      results.errors.push(`FSBO: ${e}`);
    }

    // ═══════════════════════════════════════════════════════
    // SOURCE 4: Pre-foreclosure / Tax delinquent detection
    // ═══════════════════════════════════════════════════════
    try {
      // Find parcels with high tax amounts relative to value (tax delinquency indicator)
      // and parcels recently flagged by dossier pipeline
      const taxDelinquent = await prisma.parcel.findMany({
        where: {
          AND: [
            { taxamt: { gt: 0 } },
            { parval: { gt: 0 } },
          ],
          // Tax-to-value ratio > 5% suggests delinquency
          leads: { none: { source: "pre_foreclosure" } },
        },
        select: {
          id: true,
          address: true,
          city: true,
          state: true,
          zip: true,
          owner: true,
          taxamt: true,
          parval: true,
          listingId: true,
          leads: { select: { id: true }, take: 1 },
        },
        take: 200,
      });

      // Filter for high tax-to-value ratio (potential delinquency)
      const delinquentParcels = taxDelinquent.filter((p) => {
        if (!p.taxamt || !p.parval || p.parval === 0) return false;
        const ratio = p.taxamt / p.parval;
        return ratio > 0.05; // >5% tax-to-value is high
      });

      // Also check dossier results for pre-foreclosure flags
      const preForeclosureJobs = await prisma.dossierResult.findMany({
        where: {
          motivationFlags: { has: "pre_foreclosure" },
          createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
        select: {
          job: {
            select: {
              listingId: true,
              listing: { select: { id: true, address: true } },
            },
          },
        },
        take: 20,
      });

      // Create leads for tax-delinquent parcels (top 10 by ratio)
      const sorted = delinquentParcels
        .map((p) => ({ ...p, ratio: p.taxamt! / p.parval! }))
        .sort((a, b) => b.ratio - a.ratio)
        .slice(0, 10);

      for (const parcel of sorted) {
        if (parcel.leads.length > 0) continue; // Already has a lead
        try {
          await prisma.lead.create({
            data: {
              parcelId: parcel.id,
              listingId: parcel.listingId || undefined,
              score: Math.min(Math.round(50 + parcel.ratio * 200), 95),
              scoreFactors: {
                pre_foreclosure: true,
                taxToValueRatio: Math.round(parcel.ratio * 1000) / 10,
                taxAmount: parcel.taxamt,
                assessedValue: parcel.parval,
              },
              status: "new",
              source: "pre_foreclosure",
              ownerName: parcel.owner || null,
              notes: `Tax-to-value ratio ${(parcel.ratio * 100).toFixed(1)}% — potential tax delinquency. Tax: $${parcel.taxamt}, Value: $${parcel.parval}`,
            },
          });
          results.preForeclosureLeads++;
        } catch {
          // Duplicate — skip
        }
      }

      // Also create leads from dossier pre-foreclosure flags
      for (const dr of preForeclosureJobs) {
        if (!dr.job?.listing) continue;
        const existing = await prisma.lead.findFirst({
          where: { listingId: dr.job.listingId, source: "pre_foreclosure" },
        });
        if (existing) continue;
        try {
          await prisma.lead.create({
            data: {
              listingId: dr.job.listingId,
              score: 75,
              scoreFactors: { pre_foreclosure: true, dossierFlagged: true },
              status: "new",
              source: "pre_foreclosure",
              notes: `Flagged by dossier pipeline as pre-foreclosure: ${dr.job.listing.address}`,
            },
          });
          results.preForeclosureLeads++;
        } catch {
          // Duplicate
        }
      }

      if (results.preForeclosureLeads > 0) {
        await logScanActivity("leads", `Pre-foreclosure: ${results.preForeclosureLeads} new leads from tax delinquency + dossier flags`, {
          event: "discovery",
          severity: "alert",
          meta: { count: results.preForeclosureLeads },
        });
      }
    } catch (e) {
      results.errors.push(`Pre-foreclosure: ${e}`);
    }

    // ═══════════════════════════════════════════════════════
    // AUTO-DOSSIER: Queue dossiers for hot new parcels
    // ═══════════════════════════════════════════════════════
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const hotParcels = await prisma.parcel.findMany({
      where: {
        createdAt: { gte: oneDayAgo },
        OR: [
          { isAbsentee: true },
          { isVacant: true },
          { usps_vacancy: "Y" },
        ],
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

    const needsDossier = hotParcels.filter((p) => {
      if (!p.listing) return false;
      return p.listing.dossierJobs.length === 0;
    });

    for (const parcel of needsDossier.slice(0, MAX_AUTO_DOSSIERS)) {
      try {
        await prisma.dossierJob.create({
          data: {
            listingId: parcel.listing!.id,
            leadId: parcel.leads[0]?.id ?? null,
            status: "queued",
            priority: 5,
            requestedBy: "auto-scan",
          },
        });
        results.dossiersCreated++;
      } catch (e) {
        results.errors.push(`Dossier create: ${e}`);
      }
    }

    // Parcels without listings — create lightweight listings
    const parcelsNoListing = hotParcels
      .filter((p) => !p.listing && p.address)
      .slice(0, MAX_AUTO_DOSSIERS - results.dossiersCreated);

    for (const parcel of parcelsNoListing) {
      try {
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
        await prisma.parcel.update({
          where: { id: parcel.id },
          data: { listingId: listing.id },
        });
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
        results.errors.push(`Listing+dossier: ${e}`);
      }
    }

    if (results.dossiersCreated > 0) {
      await logScanActivity("leads", `Auto-dossier: ${results.dossiersCreated} jobs queued`, {
        event: "discovery",
        severity: "success",
      });
    }

    // ═══════════════════════════════════════════════════════
    // PROCESS: Run queued dossier jobs
    // ═══════════════════════════════════════════════════════
    try {
      const processRes = await fetch(`${baseUrl}/api/leads/dossier/process?limit=5`, {
        method: "POST",
        headers: { "x-sync-secret": process.env.SYNC_SECRET || "" },
        signal: AbortSignal.timeout(300000),
      });
      const processResult = await processRes.json();
      results.dossiersProcessed = processResult.processed ?? 0;
    } catch (e) {
      results.errors.push(`Dossier processing: ${e}`);
    }

    // ═══════════════════════════════════════════════════════
    // COMPLETE
    // ═══════════════════════════════════════════════════════
    const totalItems = results.newParcels + results.expiredMlsLeads + results.fsboLeads + results.preForeclosureLeads;
    await completeScanRun(runId, {
      itemsFound: totalItems,
      alertsGen: results.dossiersCreated,
      error: results.errors.length > 0 ? results.errors.join("; ") : undefined,
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
    await logScanActivity("leads", `Lead scan failed: ${msg}`, { event: "error", severity: "alert" });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
