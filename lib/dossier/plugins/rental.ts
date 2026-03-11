/**
 * Rental History Plugin — rent estimates, eviction flags, rental indicators.
 *
 * Priority: 70 (runs after county-assessor)
 * Sources: Rentometer, Zillow, RentCast, prior court records, MLS data
 */

import type {
  DossierPlugin,
  DossierContext,
  DossierPluginResult,
  SourceLink,
} from "../types";

export const rentalPlugin: DossierPlugin = {
  name: "rental",
  label: "Rental History",
  description:
    "Estimates rental value, checks for eviction history, and identifies rental property indicators",
  category: "property",
  enabled: true,
  priority: 70,
  estimatedDuration: "< 5 sec",
  requiredConfig: [],
  dependsOn: ["county-assessor"],

  async run(context: DossierContext): Promise<DossierPluginResult> {
    const start = Date.now();
    const { listing, priorResults } = context;
    const sources: SourceLink[] = [];
    const warnings: string[] = [];

    const address = listing.address || "";
    const city = listing.city || "";
    const state = listing.state || "MO";
    const zip = listing.zip || "";

    if (!address || !city) {
      return {
        pluginName: "rental",
        success: false,
        error: "Missing address or city",
        data: {},
        sources: [],
        confidence: 0,
        warnings: [],
        durationMs: Date.now() - start,
      };
    }

    const fullAddress = `${address}, ${city}, ${state} ${zip}`.trim();

    await context.updateProgress("Analyzing rental potential...");

    const searchLinks: string[] = [];

    // ── Rentometer ─────────────────────────────────────────
    const rentometerUrl = `https://www.rentometer.com/analysis?address=${encodeURIComponent(
      fullAddress
    )}`;
    sources.push({
      label: "Rentometer — Rent Analysis",
      url: rentometerUrl,
      type: "commercial",
    });
    searchLinks.push(rentometerUrl);

    // ── Zillow Rent Zestimate ──────────────────────────────
    const zillowRentUrl = `https://www.zillow.com/rental-manager/price-my-rental/?q=${encodeURIComponent(
      fullAddress
    )}`;
    sources.push({
      label: "Zillow — Rent Zestimate",
      url: zillowRentUrl,
      type: "commercial",
    });
    searchLinks.push(zillowRentUrl);

    // ── RentCast search ────────────────────────────────────
    const rentCastUrl = `https://www.google.com/search?q=${encodeURIComponent(
      `site:rentcast.io "${address}" ${city} ${state} rental estimate`
    )}`;
    sources.push({
      label: "Google: RentCast rental estimate",
      url: rentCastUrl,
      type: "search",
    });
    searchLinks.push(rentCastUrl);

    // ── RentRange search ───────────────────────────────────
    const rentRangeUrl = `https://www.google.com/search?q=${encodeURIComponent(
      `"${address}" ${city} ${state} rent range estimate`
    )}`;
    sources.push({
      label: "Google: RentRange estimate",
      url: rentRangeUrl,
      type: "search",
    });
    searchLinks.push(rentRangeUrl);

    // ── Check prior court records for eviction cases ───────
    const evictions: Array<{
      caseNumber: string;
      date: string;
      parties: string;
      status: string;
    }> = [];

    const courtData = priorResults["court-records"]?.data || {};
    const courtCases = (courtData.cases || []) as Array<{
      type?: string;
      caseNumber?: string;
      filedDate?: string;
      parties?: string;
      status?: string;
    }>;

    for (const c of courtCases) {
      if (c.type === "eviction") {
        evictions.push({
          caseNumber: c.caseNumber || "unknown",
          date: c.filedDate || "unknown",
          parties: c.parties || "unknown",
          status: c.status || "unknown",
        });
      }
    }

    if (evictions.length > 0) {
      warnings.push(
        `Found ${evictions.length} eviction case(s) in court records`
      );
    }

    // ── Check MLS rawData for rental indicators ────────────
    const rentalIndicators: string[] = [];
    const raw = (listing.rawData || {}) as Record<string, unknown>;

    // Check ownership type
    const ownership = String(raw.Ownership || raw.ownership || "").toLowerCase();
    if (
      ownership.includes("investment") ||
      ownership.includes("rental") ||
      ownership.includes("investor")
    ) {
      rentalIndicators.push(`Ownership type: ${ownership}`);
    }

    // Check remarks for rental keywords
    const remarks = String(
      raw.PublicRemarks || raw.publicRemarks || raw.Remarks || ""
    ).toLowerCase();
    const rentalKeywords = [
      "tenant",
      "rental",
      "lease",
      "renter",
      "occupied by tenant",
      "investment property",
      "income property",
      "cash flow",
      "section 8",
      "voucher",
      "landlord",
    ];
    for (const kw of rentalKeywords) {
      if (remarks.includes(kw)) {
        rentalIndicators.push(`MLS remarks mention: "${kw}"`);
      }
    }

    // Check property type
    const propType = String(
      listing.propertyType || raw.PropertyType || ""
    ).toLowerCase();
    if (
      propType.includes("multi") ||
      propType.includes("duplex") ||
      propType.includes("triplex") ||
      propType.includes("fourplex")
    ) {
      rentalIndicators.push(`Property type: ${propType}`);
    }

    if (rentalIndicators.length > 0) {
      warnings.push(
        `Rental indicators detected: ${rentalIndicators.length} flag(s)`
      );
    }

    // ── Rough rent estimate from listing data ──────────────
    let estimatedRent: { low: number; mid: number; high: number } | null =
      null;

    const beds = listing.beds || 0;
    const baths = listing.baths || 0;
    const sqft = listing.sqft || 0;

    if (beds > 0 || sqft > 0) {
      // Rough KC metro rent per bedroom (conservative)
      // Studio: $600-800, 1BR: $750-1000, 2BR: $900-1200, 3BR: $1100-1500, 4BR+: $1300-1800
      const rentByBed: Record<number, [number, number]> = {
        0: [600, 800],
        1: [750, 1000],
        2: [900, 1200],
        3: [1100, 1500],
        4: [1300, 1800],
        5: [1500, 2200],
      };

      const bedKey = Math.min(beds, 5);
      const [low, high] = rentByBed[bedKey] || [800, 1200];

      // Adjust for bathrooms (extra bath adds ~$50-100)
      const bathAdj = Math.max(0, (baths - 1)) * 75;

      // Adjust for sqft (if significantly above average)
      const avgSqft = beds * 400 + 400;
      const sqftAdj =
        sqft > 0 && sqft > avgSqft
          ? Math.round(((sqft - avgSqft) / avgSqft) * 150)
          : 0;

      estimatedRent = {
        low: Math.round(low + bathAdj),
        mid: Math.round((low + high) / 2 + bathAdj + sqftAdj),
        high: Math.round(high + bathAdj + sqftAdj * 1.5),
      };
    }

    return {
      pluginName: "rental",
      success: true,
      data: {
        estimatedRent,
        evictions,
        rentalIndicators,
        searchLinks,
      },
      sources,
      confidence: evictions.length > 0 || rentalIndicators.length > 0 ? 0.6 : 0.3,
      warnings,
      durationMs: Date.now() - start,
    };
  },
};
