/**
 * Environmental Plugin — flood zones, EPA hazards, environmental risk.
 *
 * Priority: 80 (independent — uses lat/lng from listing)
 * Sources: FEMA NFHL API, EPA Envirofacts, EPA Superfund, MO DNR, Flood Factor
 */

import type {
  DossierPlugin,
  DossierContext,
  DossierPluginResult,
  SourceLink,
} from "../types";

// ── FEMA flood zone descriptions ───────────────────────────
const FLOOD_ZONE_DESCRIPTIONS: Record<string, string> = {
  X: "Minimal flood risk — outside 500-year floodplain",
  "X500":
    "Moderate flood risk — between 100-year and 500-year floodplain (shaded X zone)",
  A: "High flood risk — 100-year floodplain, no BFE determined",
  AE: "High flood risk — 100-year floodplain, base flood elevation determined",
  AH: "High flood risk — shallow flooding (1-3 ft), base flood elevation determined",
  AO: "High flood risk — sheet flow on sloping terrain, flood depth 1-3 ft",
  AR: "High flood risk — temporarily increased due to levee restoration",
  "A99": "High flood risk — to be protected by federal flood protection under construction",
  V: "Coastal high flood risk — velocity hazard (wave action), no BFE",
  VE: "Coastal high flood risk — velocity hazard, base flood elevation determined",
  D: "Undetermined — possible but not mapped",
};

export const environmentalPlugin: DossierPlugin = {
  name: "environmental",
  label: "Environmental",
  description:
    "Checks FEMA flood zones, EPA environmental hazards, superfund sites, and environmental risk factors",
  category: "property",
  enabled: true,
  priority: 80,
  estimatedDuration: "5-15 sec",
  requiredConfig: [],
  dependsOn: [],

  async run(context: DossierContext): Promise<DossierPluginResult> {
    const start = Date.now();
    const { listing } = context;
    const sources: SourceLink[] = [];
    const warnings: string[] = [];

    const address = listing.address || "";
    const city = listing.city || "";
    const state = listing.state || "MO";
    const zip = listing.zip || "";
    const lat = listing.lat;
    const lng = listing.lng;

    if (!address || !city) {
      return {
        pluginName: "environmental",
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

    await context.updateProgress("Checking flood zone data...");

    const environmentalLinks: string[] = [];
    let floodZone: string | null = null;
    let floodZoneDesc: string | null = null;

    // ── FEMA Flood Map search ──────────────────────────────
    const femaSearchUrl = `https://msc.fema.gov/portal/search?AddressQuery=${encodeURIComponent(
      fullAddress
    )}`;
    sources.push({
      label: "FEMA Flood Map — Property Search",
      url: femaSearchUrl,
      type: "government",
    });
    environmentalLinks.push(femaSearchUrl);

    // ── FEMA NFHL API query (if lat/lng available) ─────────
    if (lat !== null && lng !== null) {
      const nfhlUrl = `https://hazards.fema.gov/gis/nfhl/rest/services/public/NFHL/MapServer/28/query?geometry=${lng},${lat}&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=FLD_ZONE,ZONE_SUBTY,SFHA_TF&returnGeometry=false&f=json`;

      try {
        const res = await fetch(nfhlUrl, {
          headers: {
            Accept: "application/json",
          },
          signal: AbortSignal.timeout(10000),
        });

        if (res.ok) {
          const json = (await res.json()) as {
            features?: Array<{
              attributes?: {
                FLD_ZONE?: string;
                ZONE_SUBTY?: string;
                SFHA_TF?: string;
              };
            }>;
          };

          if (json.features && json.features.length > 0) {
            const attrs = json.features[0].attributes;
            if (attrs?.FLD_ZONE) {
              floodZone = attrs.FLD_ZONE;
              floodZoneDesc =
                FLOOD_ZONE_DESCRIPTIONS[floodZone] ||
                `Flood zone ${floodZone}`;

              // Flag high-risk zones
              if (
                floodZone.startsWith("A") ||
                floodZone.startsWith("V")
              ) {
                warnings.push(
                  `HIGH FLOOD RISK: Property is in FEMA flood zone ${floodZone} — ${floodZoneDesc}`
                );
              }

              if (attrs.ZONE_SUBTY) {
                floodZoneDesc += ` (subtype: ${attrs.ZONE_SUBTY})`;
              }
            }
          }
        }
      } catch {
        warnings.push(
          "FEMA NFHL API query failed — use the FEMA link for manual lookup"
        );
      }

      sources.push({
        label: "FEMA NFHL API — Flood Zone Query",
        url: nfhlUrl,
        type: "government",
        fetchedAt: new Date().toISOString(),
      });
    } else {
      warnings.push(
        "No lat/lng available — FEMA API query skipped, use manual search link"
      );
    }

    await context.updateProgress("Checking environmental hazards...");

    // ── EPA Envirofacts ────────────────────────────────────
    if (lat !== null && lng !== null) {
      const epaUrl = `https://enviro.epa.gov/enviro/efservice/${lat}/${lng}`;
      sources.push({
        label: "EPA Envirofacts — Nearby Facilities",
        url: epaUrl,
        type: "government",
      });
      environmentalLinks.push(epaUrl);
    }

    // EPA facility search by zip
    const epaFacilityUrl = `https://enviro.epa.gov/enviro/efsystemquery.v2?REGISTRY_ID=&FACILITY_NAME=&CITY_NAME=${encodeURIComponent(
      city
    )}&STATE_CODE=${state}&ZIP_CODE=${zip}`;
    sources.push({
      label: `EPA — Regulated Facilities near ${city}`,
      url: epaFacilityUrl,
      type: "government",
    });
    environmentalLinks.push(epaFacilityUrl);

    // ── EPA Superfund ──────────────────────────────────────
    const superfundUrl = `https://www.epa.gov/superfund/search-superfund-sites?search_api_fulltext=${encodeURIComponent(
      `${city} ${state}`
    )}`;
    sources.push({
      label: `EPA Superfund — Sites near ${city}`,
      url: superfundUrl,
      type: "government",
    });
    environmentalLinks.push(superfundUrl);

    // ── Missouri DNR ───────────────────────────────────────
    if (state.toUpperCase() === "MO") {
      const dnrUrl = `https://dnr.mo.gov/`;
      sources.push({
        label: "Missouri DNR — Environmental Programs",
        url: dnrUrl,
        type: "government",
      });
      environmentalLinks.push(dnrUrl);

      // Missouri Environmental Compliance Tracking System
      const ectsUrl = `https://dnr.mo.gov/environmental-compliance-tracking-system`;
      sources.push({
        label: "MO DNR — Compliance Tracking System",
        url: ectsUrl,
        type: "government",
      });
      environmentalLinks.push(ectsUrl);
    }

    // ── Flood Factor ───────────────────────────────────────
    const floodFactorUrl = `https://floodfactor.com/property/${encodeURIComponent(
      address.toLowerCase().replace(/\s+/g, "-")
    )}/${encodeURIComponent(
      `${city.toLowerCase().replace(/\s+/g, "-")}-${state.toLowerCase()}`
    )}/${zip}`;
    sources.push({
      label: "Flood Factor — Property Risk Assessment",
      url: floodFactorUrl,
      type: "commercial",
    });
    environmentalLinks.push(floodFactorUrl);

    // ── First Street Foundation ────────────────────────────
    const firstStreetUrl = `https://riskfactor.com/property/${encodeURIComponent(
      fullAddress
    )}`;
    sources.push({
      label: "Risk Factor (First Street Foundation) — Climate Risk",
      url: firstStreetUrl,
      type: "commercial",
    });
    environmentalLinks.push(firstStreetUrl);

    // ── Result ─────────────────────────────────────────────
    const confidence = floodZone !== null ? 0.8 : 0.3;

    return {
      pluginName: "environmental",
      success: true,
      data: {
        floodZone,
        floodZoneDesc,
        environmentalLinks,
      },
      sources,
      confidence,
      warnings,
      durationMs: Date.now() - start,
    };
  },
};
