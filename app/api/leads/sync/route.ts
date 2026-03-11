import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchListings, type ParsedListing } from "@/lib/mls-grid";
import { scoreListing, shouldCreateLead } from "@/lib/lead-scoring";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * POST /api/leads/sync
 *
 * Modes: ?mode=active | expired | withdrawn | incremental (default)
 * Auth: x-sync-secret header
 */
export async function POST(request: NextRequest) {
  const syncSecret = process.env.SYNC_SECRET;
  const authHeader = request.headers.get("x-sync-secret");
  if (!syncSecret || authHeader !== syncSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const mode = request.nextUrl.searchParams.get("mode") || "incremental";
  const start = Date.now();
  let recordsNew = 0;
  let recordsUpdated = 0;
  let leadsCreated = 0;

  try {
    let listings: ParsedListing[];

    if (mode === "active" || mode === "full") {
      listings = await fetchListings({ status: "Active", maxRecords: 50000 });
    } else if (mode === "expired") {
      listings = await fetchListings({ status: "Expired", maxRecords: 10000 });
    } else if (mode === "withdrawn") {
      listings = await fetchListings({ status: "Withdrawn", maxRecords: 10000 });
    } else {
      const lastSync = await prisma.syncLog.findFirst({
        where: { source: "mls_grid", error: null },
        orderBy: { createdAt: "desc" },
      });
      const since = lastSync?.createdAt ?? new Date(Date.now() - 24 * 60 * 60 * 1000);
      listings = await fetchListings({ modifiedAfter: since });
    }

    // Process in batches to avoid timeouts
    const BATCH = 100;
    for (let i = 0; i < listings.length; i += BATCH) {
      const batch = listings.slice(i, i + BATCH);

      await prisma.$transaction(
        batch.map((listing) =>
          prisma.listing.upsert({
            where: { mlsId: listing.mlsId },
            create: {
              mlsId: listing.mlsId,
              status: listing.status,
              listPrice: listing.listPrice,
              originalListPrice: listing.originalListPrice,
              address: listing.address,
              city: listing.city,
              state: listing.state,
              zip: listing.zip,
              beds: listing.beds,
              baths: listing.baths,
              sqft: listing.sqft,
              propertyType: listing.propertyType,
              daysOnMarket: listing.daysOnMarket,
              onMarketDate: listing.onMarketDate,
              closeDate: listing.closeDate,
              listingUrl: listing.listingUrl,
              photoUrls: listing.photoUrls,
              listAgentName: listing.listAgentName,
              listAgentMlsId: listing.listAgentMlsId,
              listOfficeName: listing.listOfficeName,
              listOfficeMlsId: listing.listOfficeMlsId,
              lat: listing.lat,
              lng: listing.lng,
              rawData: listing.rawData as object,
              lastSynced: new Date(),
            },
            update: {
              status: listing.status,
              listPrice: listing.listPrice,
              originalListPrice: listing.originalListPrice,
              address: listing.address,
              city: listing.city,
              state: listing.state,
              zip: listing.zip,
              beds: listing.beds,
              baths: listing.baths,
              sqft: listing.sqft,
              propertyType: listing.propertyType,
              daysOnMarket: listing.daysOnMarket,
              onMarketDate: listing.onMarketDate,
              closeDate: listing.closeDate,
              listingUrl: listing.listingUrl,
              photoUrls: listing.photoUrls,
              listAgentName: listing.listAgentName,
              listAgentMlsId: listing.listAgentMlsId,
              listOfficeName: listing.listOfficeName,
              listOfficeMlsId: listing.listOfficeMlsId,
              lat: listing.lat,
              lng: listing.lng,
              rawData: listing.rawData as object,
              lastSynced: new Date(),
            },
          })
        )
      );

      // Track new vs updated (approximate — upsert doesn't tell us)
      recordsNew += batch.length;
    }

    // Score all listings that need leads (batch query)
    const scoreable = listings
      .map((l) => {
        const result = scoreListing(l);
        return shouldCreateLead(result) ? { listing: l, result } : null;
      })
      .filter(Boolean) as Array<{
      listing: ParsedListing;
      result: ReturnType<typeof scoreListing>;
    }>;

    if (scoreable.length > 0) {
      // Get all listing IDs for scoreable items
      const mlsIds = scoreable.map((s) => s.listing.mlsId);
      const dbListings = await prisma.listing.findMany({
        where: { mlsId: { in: mlsIds } },
        select: { id: true, mlsId: true },
      });
      const mlsToId = new Map(dbListings.map((l) => [l.mlsId, l.id]));

      // Get existing leads
      const listingIds = dbListings.map((l) => l.id);
      const existingLeads = await prisma.lead.findMany({
        where: { listingId: { in: listingIds }, status: { not: "dead" } },
        select: { id: true, listingId: true, score: true },
      });
      const leadByListing = new Map(
        existingLeads.map((l) => [l.listingId, l])
      );

      for (const { listing, result } of scoreable) {
        const listingId = mlsToId.get(listing.mlsId);
        if (!listingId) continue;

        const existing = leadByListing.get(listingId);
        if (!existing) {
          await prisma.lead.create({
            data: {
              listingId,
              score: result.score,
              scoreFactors: result.factors,
              source: result.source,
              notes: result.summary,
            },
          });
          leadsCreated++;
        } else if (result.score > existing.score) {
          await prisma.lead.update({
            where: { id: existing.id },
            data: {
              score: result.score,
              scoreFactors: result.factors,
              notes: result.summary,
            },
          });
        }
      }
    }

    // ── Speed-to-Lead Auto-Response Trigger ──
    // Fire auto-responder for newly created high-score leads
    let autoResponded = 0;
    if (leadsCreated > 0) {
      try {
        // Fetch the leads we just created (with phone numbers)
        const recentLeads = await prisma.lead.findMany({
          where: {
            createdAt: { gte: new Date(start) },
            status: "new",
            ownerPhone: { not: null },
          },
          select: { id: true, score: true, source: true, ownerPhone: true, listingId: true },
          take: 50,
        });

        if (recentLeads.length > 0) {
          const baseUrl = process.env.VERCEL_URL
            ? `https://${process.env.VERCEL_URL}`
            : process.env.NEXTAUTH_URL || "http://localhost:3000";

          const triggerRes = await fetch(`${baseUrl}/api/leads/auto-responder/trigger`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-sync-secret": syncSecret,
            },
            body: JSON.stringify({
              leads: recentLeads.map((l) => ({
                id: l.id,
                score: l.score,
                source: l.source,
                ownerPhone: l.ownerPhone,
                listingId: l.listingId,
              })),
            }),
          });
          if (triggerRes.ok) {
            const triggerData = await triggerRes.json();
            autoResponded = triggerData.triggered || 0;
          }
        }
      } catch (err) {
        console.error("[leads/sync] Auto-responder trigger error:", err);
        // Non-fatal — sync still succeeds
      }
    }

    const duration = Date.now() - start;

    await prisma.syncLog.create({
      data: {
        source: "mls_grid",
        recordsTotal: listings.length,
        recordsNew,
        recordsUpdated,
        duration,
      },
    });

    return NextResponse.json({
      ok: true,
      mode,
      total: listings.length,
      upserted: recordsNew,
      leadsCreated,
      leadsScoreable: scoreable.length,
      autoResponded,
      durationMs: duration,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[leads/sync]", err);

    await prisma.syncLog.create({
      data: {
        source: "mls_grid",
        recordsTotal: 0,
        recordsNew,
        recordsUpdated,
        duration: Date.now() - start,
        error: message,
      },
    });

    return NextResponse.json(
      { error: "Sync failed", detail: message },
      { status: 500 }
    );
  }
}
