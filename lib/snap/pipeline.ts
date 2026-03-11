/**
 * Snap & Know pipeline — orchestrates photo → GPS → address → dossier → equity.
 *
 * Called in the background after a snap request is created.
 * Updates SnapRequest status as it progresses.
 */

import { prisma } from "@/lib/prisma";
import { reverseGeocode, forwardGeocode } from "./geocode";
import { estimateEquity } from "./equity";
import { runDossierPipeline } from "@/lib/dossier/pipeline";

/**
 * Process a snap request through the full pipeline.
 * Meant to be called via after() or in a background context.
 */
export async function processSnapRequest(snapId: string): Promise<void> {
  const snap = await prisma.snapRequest.findUnique({ where: { id: snapId } });
  if (!snap) return;

  try {
    // Step 1: Determine GPS coordinates
    let lat = snap.photoExifLat ?? snap.browserLat;
    let lng = snap.photoExifLng ?? snap.browserLng;

    // If manual address was provided but no GPS, forward geocode
    if (!lat && !lng && snap.manualAddress) {
      await prisma.snapRequest.update({
        where: { id: snapId },
        data: { status: "geocoding" },
      });

      // Try to parse "address, city, state" from manual input
      const parts = snap.manualAddress.split(",").map((s) => s.trim());
      const address = parts[0] || snap.manualAddress;
      const city = parts[1] || "";
      const state = parts[2] || "MO";

      const coords = await forwardGeocode(address, city, state);
      if (coords) {
        lat = coords.lat;
        lng = coords.lng;
      }

      // Even without GPS, we can proceed with the address
      await prisma.snapRequest.update({
        where: { id: snapId },
        data: {
          resolvedLat: lat,
          resolvedLng: lng,
          resolvedAddress: address,
          resolvedCity: city || null,
          resolvedState: state,
        },
      });
    }

    // Step 2: Reverse geocode GPS to address (if we have GPS but no resolved address)
    if (lat && lng && !snap.resolvedAddress) {
      await prisma.snapRequest.update({
        where: { id: snapId },
        data: { status: "geocoding" },
      });

      const geocoded = await reverseGeocode(lat, lng);
      if (geocoded) {
        await prisma.snapRequest.update({
          where: { id: snapId },
          data: {
            resolvedLat: lat,
            resolvedLng: lng,
            resolvedAddress: geocoded.address,
            resolvedCity: geocoded.city,
            resolvedState: geocoded.state,
            resolvedZip: geocoded.zip,
            resolvedCounty: geocoded.county,
          },
        });
      } else {
        await prisma.snapRequest.update({
          where: { id: snapId },
          data: {
            resolvedLat: lat,
            resolvedLng: lng,
            status: "needs_address",
          },
        });
        return; // Can't proceed without an address
      }
    }

    // Reload snap with resolved data
    const resolved = await prisma.snapRequest.findUnique({ where: { id: snapId } });
    if (!resolved?.resolvedAddress) {
      await prisma.snapRequest.update({
        where: { id: snapId },
        data: { status: "needs_address" },
      });
      return;
    }

    // Step 3: Find or create Listing
    await prisma.snapRequest.update({
      where: { id: snapId },
      data: { status: "researching" },
    });

    let listingId: string;

    // Try to match existing listing by address similarity
    const existingListing = await prisma.listing.findFirst({
      where: {
        address: {
          contains: resolved.resolvedAddress.split(" ").slice(0, 3).join(" "),
          mode: "insensitive",
        },
        ...(resolved.resolvedZip ? { zip: resolved.resolvedZip } : {}),
      },
    });

    if (existingListing) {
      listingId = existingListing.id;
    } else {
      // Create a new listing from snap data
      const newListing = await prisma.listing.create({
        data: {
          mlsId: `snap-${snapId}`,
          status: "Unknown",
          address: resolved.resolvedAddress,
          city: resolved.resolvedCity,
          state: resolved.resolvedState || "MO",
          zip: resolved.resolvedZip,
          lat: resolved.resolvedLat,
          lng: resolved.resolvedLng,
          source: "snap",
          photoUrls: [resolved.photoUrl],
        },
      });
      listingId = newListing.id;
    }

    // Step 4: Create DossierJob and run pipeline
    const dossierJob = await prisma.dossierJob.create({
      data: {
        listingId,
        requestedBy: resolved.userId,
        priority: 10, // Higher priority for snap (user is waiting)
      },
    });

    await prisma.snapRequest.update({
      where: { id: snapId },
      data: {
        listingId,
        dossierJobId: dossierJob.id,
      },
    });

    // Run the dossier pipeline (this is the long part — 1-5 min)
    await runDossierPipeline(dossierJob.id);

    // Step 5: Compute equity from dossier results
    const dossierResult = await prisma.dossierResult.findUnique({
      where: { jobId: dossierJob.id },
    });

    const listing = await prisma.listing.findUnique({
      where: { id: listingId },
      include: { enrichment: true },
    });

    if (dossierResult) {
      // Gather data for equity estimation
      const pluginData = dossierResult.pluginData as Record<string, { data?: Record<string, unknown> }> | null;
      const assessorData = pluginData?.["county-assessor"]?.data;
      const historyData = pluginData?.["property-history"]?.data;
      const workerData = pluginData?.["dgx-research-worker"]?.data;

      const equityResult = estimateEquity({
        zestimate: (workerData as Record<string, unknown>)?.zestimate as number | undefined,
        refdinEstimate: (workerData as Record<string, unknown>)?.redfin_estimate as number | undefined,
        marketValue: assessorData?.marketValue as number | undefined,
        assessedValue: (assessorData?.assessedValue ?? listing?.enrichment?.assessedValue) as number | undefined,
        assessmentRatio: listing?.enrichment?.assessmentRatio ?? undefined,
        listPrice: listing?.listPrice ?? undefined,
        lastSalePrice: undefined, // Will be extracted from deed history
        deedHistory: (historyData?.deedHistory ?? dossierResult.deedHistory) as Array<{ price?: number | null; date?: string }> | undefined,
      });

      // Store equity on snap and in dossier financial data
      if (equityResult) {
        await prisma.snapRequest.update({
          where: { id: snapId },
          data: {
            estimatedEquity: equityResult.equityEstimate,
            equityBreakdown: JSON.parse(JSON.stringify(equityResult)),
          },
        });

        // Also store in DossierResult.financialData
        await prisma.dossierResult.update({
          where: { jobId: dossierJob.id },
          data: {
            financialData: JSON.parse(JSON.stringify({
              estimatedEquity: equityResult.equityEstimate,
              mortgageBalance: equityResult.mortgageEstimate,
              lastSalePrice: equityResult.marketValue, // For reference
              lastSaleDate: null,
              preForeclosure: false,
              ...equityResult,
            })),
          },
        });
      }
    }

    // Mark complete
    await prisma.snapRequest.update({
      where: { id: snapId },
      data: { status: "complete" },
    });

    console.log(`[Snap] Request ${snapId} completed successfully`);
  } catch (err) {
    console.error(`[Snap] Request ${snapId} failed:`, err);
    await prisma.snapRequest.update({
      where: { id: snapId },
      data: {
        status: "failed",
        errorMessage: err instanceof Error ? err.message : "Unknown error",
      },
    });
  }
}
