/**
 * Instant Assembly — Phase 1 of dossier flow.
 *
 * Assembles a partial DossierResult from pre-loaded DB data (no network calls).
 * Sources: Listing.rawData, NarrprImport, Lead, Parcel, ListingEnrichment.
 * Returns data in 0-2 seconds so the detail page renders immediately.
 */

import { prisma } from "@/lib/prisma";

export interface InstantDossierData {
  owners: Array<{
    name: string;
    role: string;
    phone?: string;
    email?: string;
    address?: string;
    confidence: number;
  }>;
  entityType: string;
  entityName: string | null;
  motivationScore: number;
  motivationFlags: string[];
  streetViewUrl: string | null;
  satelliteUrl: string | null;
  neighborhoodPhotos: string[];
  researchSummary: string | null;
  pluginData: Record<string, unknown>;
}

export async function assembleInstantDossier(
  listingId: string,
  leadId?: string | null
): Promise<InstantDossierData> {
  // Parallel queries for all pre-loaded sources
  const [listing, parcel, narrprImports, lead] = await Promise.all([
    prisma.listing.findUnique({
      where: { id: listingId },
      include: { enrichment: true },
    }),
    prisma.parcel.findFirst({
      where: { listingId },
    }),
    prisma.narrprImport.findMany({
      where: { matchedListingId: listingId },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    leadId
      ? prisma.lead.findUnique({
          where: { id: leadId },
          select: {
            ownerName: true,
            ownerPhone: true,
            ownerEmail: true,
            score: true,
            scoreFactors: true,
          },
        })
      : null,
  ]);

  const owners: InstantDossierData["owners"] = [];
  const motivationFlags: string[] = [];
  let motivationScore = 0;
  let entityType = "individual";
  let entityName: string | null = null;
  const pluginData: Record<string, unknown> = {};

  const raw = (listing?.rawData || {}) as Record<string, unknown>;

  // ── Extract from Listing.rawData (Remine sell score, AVM, equity, occupancy) ──
  const remineSellScore = typeof raw.SellScore === "number" ? raw.SellScore : null;
  const remineAvm = typeof raw.Avm === "number" ? raw.Avm : null;
  const remineEquity = typeof raw.EquityPercent === "number" ? raw.EquityPercent : null;
  const occupancy = typeof raw.Occupancy === "string" ? raw.Occupancy : null;

  if (remineSellScore != null && remineSellScore >= 70) {
    motivationFlags.push("high_sell_score");
    motivationScore += 15;
  }
  if (occupancy === "Vacant" || occupancy === "vacant") {
    if (!motivationFlags.includes("vacant")) {
      motivationFlags.push("vacant");
      motivationScore += 10;
    }
  }

  // Owner from rawData
  const rawOwnerName = typeof raw.ownerName === "string" ? raw.ownerName.trim() : "";

  // ── Extract from Lead ──
  if (lead?.ownerName) {
    owners.push({
      name: lead.ownerName,
      role: "owner",
      phone: lead.ownerPhone || undefined,
      email: lead.ownerEmail || undefined,
      confidence: 0.8,
    });
  } else if (rawOwnerName) {
    owners.push({
      name: rawOwnerName,
      role: "owner",
      confidence: 0.7,
    });
  }

  // ── Extract from NarrprImport (RPR owner records) ──
  for (const narrpr of narrprImports) {
    // Owner names from RPR
    if (narrpr.ownerName) {
      const existing = owners.find(
        (o) => o.name.toLowerCase() === narrpr.ownerName!.toLowerCase()
      );
      if (!existing) {
        owners.push({
          name: narrpr.ownerName,
          role: "owner",
          address: [narrpr.mailingAddress, narrpr.mailingCity, narrpr.mailingState, narrpr.mailingZip]
            .filter(Boolean)
            .join(", ") || undefined,
          confidence: 0.85,
        });
      } else if (!existing.address && narrpr.mailingAddress) {
        existing.address = [narrpr.mailingAddress, narrpr.mailingCity, narrpr.mailingState, narrpr.mailingZip]
          .filter(Boolean)
          .join(", ");
      }
    }
    if (narrpr.ownerName2) {
      const existing = owners.find(
        (o) => o.name.toLowerCase() === narrpr.ownerName2!.toLowerCase()
      );
      if (!existing) {
        owners.push({
          name: narrpr.ownerName2,
          role: "co-owner",
          confidence: 0.8,
        });
      }
    }

    // RVM data
    if (narrpr.rvmValue) {
      pluginData["narrpr-rvm"] = narrpr.rvmValue;
    }

    // Distress signals
    const distress = narrpr.distressData as { nodDate?: string; auctionDate?: string } | null;
    if (distress?.nodDate) {
      if (!motivationFlags.includes("pre_foreclosure")) {
        motivationFlags.push("pre_foreclosure");
        motivationScore += 25;
      }
    }
    if (distress?.auctionDate) {
      motivationScore += 10;
    }

    // Deed records for history
    if (narrpr.deedRecords) {
      pluginData["narrpr-deeds"] = narrpr.deedRecords;
    }

    // Mortgage data
    if (narrpr.mortgageData) {
      pluginData["narrpr-mortgage"] = narrpr.mortgageData;
    }

    // Tapestry demographics
    if (narrpr.esriTapestry) {
      pluginData["narrpr-tapestry"] = narrpr.esriTapestry;
    }
  }

  // ── Extract from Parcel (Regrid) ──
  if (parcel) {
    // Owner from Regrid
    if (parcel.owner) {
      const existing = owners.find(
        (o) => o.name.toLowerCase() === parcel.owner!.toLowerCase()
      );
      if (!existing) {
        owners.push({
          name: parcel.owner,
          role: "owner",
          address: [parcel.mailadd, parcel.mailcity, parcel.mailstate, parcel.mailzip]
            .filter(Boolean)
            .join(", ") || undefined,
          confidence: 0.75,
        });
      }
    }

    // Flags
    if (parcel.isAbsentee) {
      if (!motivationFlags.includes("absentee_owner")) {
        motivationFlags.push("absentee_owner");
        motivationScore += 15;
      }
    }
    if (parcel.isVacant) {
      if (!motivationFlags.includes("vacant")) {
        motivationFlags.push("vacant");
        motivationScore += 15;
      }
    }

    // Entity type detection
    if (parcel.owner) {
      const lower = parcel.owner.toLowerCase();
      if (lower.includes("llc")) { entityType = "llc"; entityName = parcel.owner; }
      else if (lower.includes("corp") || lower.includes("inc")) { entityType = "corporate"; entityName = parcel.owner; }
      else if (lower.includes("trust")) { entityType = "trust"; entityName = parcel.owner; }
      else if (lower.includes("estate")) { entityType = "estate"; entityName = parcel.owner; }
    }

    // Parcel data as plugin data for the view
    pluginData["regrid-instant"] = {
      isAbsentee: parcel.isAbsentee,
      isVacant: parcel.isVacant,
      assessedValue: parcel.parval,
      landValue: parcel.landval,
      improvementValue: parcel.improvval,
      taxAmount: parcel.taxamt,
      lastSalePrice: parcel.saleprice,
      lastSaleDate: parcel.saledate,
      yearBuilt: parcel.yearbuilt,
      apn: parcel.parcelnumb,
      mailingAddress: [parcel.mailadd, parcel.mailcity, parcel.mailstate, parcel.mailzip]
        .filter(Boolean)
        .join(", "),
    };
  }

  // ── Extract from ListingEnrichment ──
  if (listing?.enrichment) {
    const e = listing.enrichment;
    if (e.estimatedAnnualTax) {
      pluginData["enrichment-tax"] = {
        estimatedAnnualTax: e.estimatedAnnualTax,
        estimatedMonthlyTax: e.estimatedMonthlyTax,
        effectiveTaxRate: e.effectiveTaxRate,
        taxBurdenRating: e.taxBurdenRating,
        countyName: e.countyName,
      };
    }
  }

  // ── Listing-based motivation signals ──
  if (listing) {
    if (listing.daysOnMarket && listing.daysOnMarket > 90) {
      motivationFlags.push("high_dom");
      motivationScore += Math.min(25, Math.floor(listing.daysOnMarket / 10));
    }
    if (
      listing.originalListPrice &&
      listing.listPrice &&
      listing.originalListPrice > listing.listPrice
    ) {
      motivationFlags.push("price_drop");
      const dropPct =
        ((listing.originalListPrice - listing.listPrice) / listing.originalListPrice) * 100;
      motivationScore += Math.min(25, Math.floor(dropPct * 2));
    }

    // Street view from lat/lng
    const lat = listing.lat;
    const lng = listing.lng;
    const gmapsKey = process.env.GOOGLE_MAPS_API_KEY;
    let streetViewUrl: string | null = null;
    let satelliteUrl: string | null = null;

    if (lat && lng && gmapsKey) {
      streetViewUrl = `https://maps.googleapis.com/maps/api/streetview?size=640x480&location=${lat},${lng}&key=${gmapsKey}`;
      satelliteUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=18&size=640x480&maptype=satellite&key=${gmapsKey}`;
    }

    // Build summary from what we have
    const summaryParts: string[] = [];
    if (owners.length > 0) summaryParts.push(`Owner: ${owners[0].name}`);
    if (remineSellScore != null) summaryParts.push(`Remine Sell Score: ${remineSellScore}`);
    if (remineAvm != null) summaryParts.push(`AVM: $${remineAvm.toLocaleString()}`);
    if (parcel?.isAbsentee) summaryParts.push("Absentee owner");
    if (parcel?.isVacant) summaryParts.push("USPS Vacant");
    if (motivationFlags.includes("pre_foreclosure")) summaryParts.push("Pre-foreclosure (NOD on file)");

    return {
      owners: owners.length > 0 ? JSON.parse(JSON.stringify(owners)) : [],
      entityType,
      entityName,
      motivationScore: Math.min(100, motivationScore),
      motivationFlags: [...new Set(motivationFlags)],
      streetViewUrl,
      satelliteUrl,
      neighborhoodPhotos: [],
      researchSummary: summaryParts.length > 0
        ? `[Instant Assembly] ${summaryParts.join(" | ")}\n\nDeep research in progress...`
        : "Deep research starting...",
      pluginData: JSON.parse(JSON.stringify(pluginData)),
    };
  }

  // Fallback if listing not found
  return {
    owners: [],
    entityType: "individual",
    entityName: null,
    motivationScore: 0,
    motivationFlags: [],
    streetViewUrl: null,
    satelliteUrl: null,
    neighborhoodPhotos: [],
    researchSummary: null,
    pluginData: {},
  };
}
