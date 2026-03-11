/**
 * Regrid Dossier Plugin — structured parcel data from Regrid API.
 *
 * Priority: 5 (runs BEFORE county-assessor at 10)
 * Provides: owner names, assessed values, sale history, absentee flag,
 *           vacancy, zoning, lot size, APN, portfolio size, QOZ flag.
 *
 * When this plugin succeeds with high confidence, county-assessor can skip scraping.
 */

import type {
  DossierPlugin,
  DossierContext,
  DossierPluginResult,
  OwnerInfo,
  SourceLink,
} from "../types";
import {
  lookupByAddress,
  lookupByPoint,
  searchByOwner,
  type ParsedParcel,
} from "@/lib/regrid";

export const regridPlugin: DossierPlugin = {
  name: "regrid",
  label: "Regrid Parcel Data",
  description:
    "Structured parcel data: owner names, assessed values, vacancy, absentee detection, zoning, QOZ, lot size",
  category: "ownership",
  enabled: true,
  priority: 5,
  estimatedDuration: "5-15 sec",
  requiredConfig: ["REGRID_API_TOKEN"],
  dependsOn: [],

  async run(context: DossierContext): Promise<DossierPluginResult> {
    const start = Date.now();
    const { listing, knownOwners } = context;
    const sources: SourceLink[] = [];
    const warnings: string[] = [];

    await context.updateProgress("Querying Regrid parcel database...");

    let parcels: ParsedParcel[] = [];

    // Try address lookup first
    if (listing.address) {
      try {
        parcels = await lookupByAddress(listing.address);
      } catch (err) {
        warnings.push(
          `Address lookup failed: ${err instanceof Error ? err.message : "unknown"}`
        );
      }
    }

    // Fallback to point lookup if address didn't match
    if (parcels.length === 0 && listing.lat && listing.lng) {
      try {
        parcels = await lookupByPoint(listing.lat, listing.lng);
      } catch (err) {
        warnings.push(
          `Point lookup failed: ${err instanceof Error ? err.message : "unknown"}`
        );
      }
    }

    if (parcels.length === 0) {
      return {
        pluginName: "regrid",
        success: false,
        error: "No parcel found for this address",
        data: {},
        sources,
        confidence: 0,
        warnings,
        durationMs: Date.now() - start,
      };
    }

    const parcel = parcels[0];

    // Build source links
    sources.push({
      label: "Regrid Parcel Lookup",
      url: `https://app.regrid.com/us/${(parcel.state || "mo").toLowerCase()}/${(parcel.county || "").toLowerCase().replace(/\s+/g, "-")}/${parcel.regridId}`,
      type: "commercial",
      fetchedAt: new Date().toISOString(),
    });

    // Parse owner info
    const owners: OwnerInfo[] = [];
    if (parcel.owner) {
      // Try to get first/last name breakdown
      if (parcel.ownfrst && parcel.ownlast) {
        owners.push({
          name: `${parcel.ownfrst} ${parcel.ownlast}`,
          role: "owner",
          address: [parcel.mailadd, parcel.mailcity, parcel.mailstate, parcel.mailzip]
            .filter(Boolean)
            .join(", ") || undefined,
          confidence: 0.95,
        });
      }

      // If entity/trust/LLC, add the full name too
      const ownerLower = parcel.owner.toLowerCase();
      if (
        ownerLower.includes("trust") ||
        ownerLower.includes("llc") ||
        ownerLower.includes("corp") ||
        ownerLower.includes("inc") ||
        ownerLower.includes("estate")
      ) {
        owners.push({
          name: parcel.owner,
          role: "owner",
          confidence: 0.95,
        });
      } else if (!parcel.ownfrst) {
        // No first/last breakdown — use raw owner
        owners.push({
          name: parcel.owner,
          role: "owner",
          address: [parcel.mailadd, parcel.mailcity, parcel.mailstate, parcel.mailzip]
            .filter(Boolean)
            .join(", ") || undefined,
          confidence: 0.9,
        });
      }

      // Feed into knownOwners for downstream plugins
      for (const o of owners) {
        if (!knownOwners.some((k) => k.name === o.name)) {
          knownOwners.push(o);
        }
      }
    }

    // Portfolio detection — if we have an owner name, search for other properties
    let portfolioSize = 0;
    let portfolioParcels: { address: string; city: string | null; parval: number | null }[] = [];
    if (parcel.owner) {
      try {
        await context.updateProgress("Checking owner portfolio...");
        const portfolio = await searchByOwner(parcel.owner, {
          state: parcel.state || undefined,
          county: parcel.county || undefined,
        });
        portfolioSize = portfolio.length;
        portfolioParcels = portfolio
          .filter((p) => p.regridId !== parcel.regridId)
          .slice(0, 20) // Cap for display
          .map((p) => ({
            address: p.address,
            city: p.city,
            parval: p.parval,
          }));
      } catch {
        warnings.push("Portfolio search failed — owner may still own multiple properties");
      }
    }

    // Build data payload
    const data: Record<string, unknown> = {
      owners,
      apn: parcel.parcelnumb,
      // Assessment
      assessedValue: parcel.parval,
      landValue: parcel.landval,
      improvementValue: parcel.improvval,
      // Last sale
      lastSalePrice: parcel.saleprice,
      lastSaleDate: parcel.saledate,
      taxAmount: parcel.taxamt,
      // Structure
      yearBuilt: parcel.yearbuilt,
      stories: parcel.numstories,
      units: parcel.numunits,
      bedrooms: parcel.num_bedrooms,
      bathrooms: parcel.num_bath,
      structureType: parcel.struct,
      // Lot
      lotAcres: parcel.ll_gisacre,
      lotSqft: parcel.ll_gissqft,
      // Zoning
      zoning: parcel.zoning,
      zoningDescription: parcel.zoning_description,
      // Flags
      isAbsentee: parcel.isAbsentee,
      isVacant: parcel.isVacant,
      uspsVacancy: parcel.usps_vacancy,
      qoz: parcel.qoz,
      // Owner details
      ownerType: parcel.owntype,
      mailingAddress: [parcel.mailadd, parcel.mailcity, parcel.mailstate, parcel.mailzip]
        .filter(Boolean)
        .join(", "),
      // Portfolio
      portfolioSize,
      portfolioParcels,
      // Location
      county: parcel.county,
      lat: parcel.lat,
      lng: parcel.lng,
    };

    return {
      pluginName: "regrid",
      success: true,
      data,
      sources,
      confidence: 0.95,
      warnings,
      durationMs: Date.now() - start,
    };
  },
};
