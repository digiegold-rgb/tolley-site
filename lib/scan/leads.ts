/**
 * lib/scan/leads.ts
 *
 * Business logic for the autonomous lead scanner (Phase 2 Enhanced).
 * Sources: Regrid parcels, expired/withdrawn MLS, FSBO, pre-foreclosure.
 * Extracted from app/api/scan/leads/route.ts — route is now a thin orchestrator.
 */

import { prisma } from "@/lib/prisma";
import { logScanActivity } from "@/lib/scan/log";

export const MAX_AUTO_DOSSIERS = 15;
const RESEARCH_WORKER_URL =
  process.env.RESEARCH_WORKER_URL || "http://localhost:8900";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Returns the union of farmZips across all active lead subscribers. */
export async function getFarmZips(): Promise<Set<string>> {
  const subscribers = await prisma.leadSubscriber.findMany({
    where: { status: "active" },
    select: { farmZips: true },
  });
  const allZips = new Set<string>();
  for (const sub of subscribers) {
    for (const zip of sub.farmZips) allZips.add(zip);
  }
  return allZips;
}

// ─────────────────────────────────────────────────────────────────────────────
// Source 1: Regrid parcel scan
// ─────────────────────────────────────────────────────────────────────────────

export interface RegridScanResult {
  regridScan: Record<string, unknown> | null;
  newParcels: number;
  errors: string[];
}

export async function runRegridScan(
  baseUrl: string,
  allZips: Set<string>
): Promise<RegridScanResult> {
  const result: RegridScanResult = {
    regridScan: null,
    newParcels: 0,
    errors: [],
  };

  if (allZips.size === 0) return result;

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
    result.regridScan = await scanRes.json();
    result.newParcels =
      (result.regridScan as Record<string, number>)?.newParcels ?? 0;

    if (result.newParcels > 0) {
      await logScanActivity(
        "leads",
        `Regrid: ${result.newParcels} new parcels across ${allZips.size} zips`,
        {
          event: "discovery",
          severity: "success",
          meta: { zips: [...allZips], newParcels: result.newParcels },
        }
      );
    }
  } catch (e) {
    result.errors.push(`Regrid: ${e}`);
  }

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Source 2: Expired / Withdrawn MLS listings
// ─────────────────────────────────────────────────────────────────────────────

export interface ExpiredMlsScanResult {
  expiredMlsLeads: number;
  errors: string[];
}

export async function runExpiredMlsScan(): Promise<ExpiredMlsScanResult> {
  const result: ExpiredMlsScanResult = { expiredMlsLeads: 0, errors: [] };

  try {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

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
        const source =
          listing.daysOnMarket && listing.daysOnMarket > 90
            ? "mls_dom"
            : "mls_expired";

        let score = 40;
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
        result.expiredMlsLeads++;
      } catch {
        // Likely duplicate — skip silently
      }
    }

    if (result.expiredMlsLeads > 0) {
      await logScanActivity(
        "leads",
        `Expired MLS: ${result.expiredMlsLeads} new leads from expired/withdrawn listings`,
        {
          event: "discovery",
          severity: "success",
          meta: { count: result.expiredMlsLeads },
        }
      );
    }
  } catch (e) {
    result.errors.push(`Expired MLS: ${e}`);
  }

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Source 3: FSBO detection via research worker
// ─────────────────────────────────────────────────────────────────────────────

export interface FsboScanResult {
  fsboLeads: number;
  errors: string[];
}

export async function runFsboScan(
  allZips: Set<string>
): Promise<FsboScanResult> {
  const result: FsboScanResult = { fsboLeads: 0, errors: [] };

  try {
    const farmCities = new Set<string>();
    const subs = await prisma.leadSubscriber.findMany({
      where: { status: "active" },
      select: { farmCities: true, farmZips: true },
    });
    for (const sub of subs) {
      for (const city of sub.farmCities) farmCities.add(city);
    }

    // Fallback: derive cities from zip-matched listings
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

    if (farmCities.size === 0) return result;

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

        if (!fsboRes.ok) continue;

        const fsboData = await fsboRes.json();
        const listings = fsboData.listings || [];

        for (const fsbo of listings) {
          if (!fsbo.address) continue;
          try {
            const existing = await prisma.listing.findFirst({
              where: {
                address: { contains: fsbo.address, mode: "insensitive" },
              },
            });
            if (existing) continue;

            const listing = await prisma.listing.create({
              data: {
                mlsId: `fsbo-${Date.now()}-${Math.random()
                  .toString(36)
                  .slice(2, 8)}`,
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
                score: 55,
                scoreFactors: { fsbo: true, source: fsbo.source || "unknown" },
                status: "new",
                source: "fsbo",
                ownerName: fsbo.ownerName || null,
                ownerPhone: fsbo.phone || null,
                notes: `FSBO listing found on ${fsbo.source || "web"}. Price: $${fsbo.price || "?"}`,
              },
            });
            result.fsboLeads++;
          } catch {
            // Duplicate or invalid — skip
          }
        }
      } catch {
        // Research worker FSBO endpoint may not exist yet — not an error
      }
    }

    if (result.fsboLeads > 0) {
      await logScanActivity(
        "leads",
        `FSBO: ${result.fsboLeads} new leads from FSBO listings`,
        {
          event: "discovery",
          severity: "success",
          meta: {
            count: result.fsboLeads,
            cities: [...farmCities].slice(0, 5),
          },
        }
      );
    }
  } catch (e) {
    result.errors.push(`FSBO: ${e}`);
  }

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Source 4: Pre-foreclosure / Tax delinquent detection
// ─────────────────────────────────────────────────────────────────────────────

export interface PreForeclosureScanResult {
  preForeclosureLeads: number;
  errors: string[];
}

export async function runPreForeclosureScan(): Promise<PreForeclosureScanResult> {
  const result: PreForeclosureScanResult = {
    preForeclosureLeads: 0,
    errors: [],
  };

  try {
    const taxDelinquent = await prisma.parcel.findMany({
      where: {
        AND: [{ taxamt: { gt: 0 } }, { parval: { gt: 0 } }],
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

    const delinquentParcels = taxDelinquent.filter((p) => {
      if (!p.taxamt || !p.parval || p.parval === 0) return false;
      return p.taxamt / p.parval > 0.05;
    });

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

    // Top 10 delinquent parcels by tax-to-value ratio
    const sorted = delinquentParcels
      .map((p) => ({ ...p, ratio: p.taxamt! / p.parval! }))
      .sort((a, b) => b.ratio - a.ratio)
      .slice(0, 10);

    for (const parcel of sorted) {
      if (parcel.leads.length > 0) continue;
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
        result.preForeclosureLeads++;
      } catch {
        // Duplicate — skip
      }
    }

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
        result.preForeclosureLeads++;
      } catch {
        // Duplicate
      }
    }

    if (result.preForeclosureLeads > 0) {
      await logScanActivity(
        "leads",
        `Pre-foreclosure: ${result.preForeclosureLeads} new leads from tax delinquency + dossier flags`,
        {
          event: "discovery",
          severity: "alert",
          meta: { count: result.preForeclosureLeads },
        }
      );
    }
  } catch (e) {
    result.errors.push(`Pre-foreclosure: ${e}`);
  }

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Auto-dossier: queue dossier jobs for hot new parcels
// ─────────────────────────────────────────────────────────────────────────────

export interface AutoDossierResult {
  dossiersCreated: number;
  errors: string[];
}

export async function queueAutoDossiers(
  remaining: number = MAX_AUTO_DOSSIERS
): Promise<AutoDossierResult> {
  const result: AutoDossierResult = { dossiersCreated: 0, errors: [] };

  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const hotParcels = await prisma.parcel.findMany({
    where: {
      createdAt: { gte: oneDayAgo },
      OR: [{ isAbsentee: true }, { isVacant: true }, { usps_vacancy: "Y" }],
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

  // Parcels with existing listings that don't yet have a dossier job
  const needsDossier = hotParcels.filter(
    (p) => p.listing && p.listing.dossierJobs.length === 0
  );

  for (const parcel of needsDossier.slice(0, remaining)) {
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
      result.dossiersCreated++;
    } catch (e) {
      result.errors.push(`Dossier create: ${e}`);
    }
  }

  // Parcels without listings — create a lightweight listing first
  const slots = remaining - result.dossiersCreated;
  const parcelsNoListing = hotParcels
    .filter((p) => !p.listing && p.address)
    .slice(0, slots);

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
      result.dossiersCreated++;
    } catch (e) {
      result.errors.push(`Listing+dossier: ${e}`);
    }
  }

  if (result.dossiersCreated > 0) {
    await logScanActivity(
      "leads",
      `Auto-dossier: ${result.dossiersCreated} jobs queued`,
      { event: "discovery", severity: "success" }
    );
  }

  return result;
}
