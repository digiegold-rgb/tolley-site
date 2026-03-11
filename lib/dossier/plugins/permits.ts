/**
 * Building Permits Plugin — permit portals, code violations, enforcement.
 *
 * Priority: 65 (runs after county-assessor)
 * Sources: City permit portals (KC metro), Google searches, county enforcement
 */

import type {
  DossierPlugin,
  DossierContext,
  DossierPluginResult,
  SourceLink,
} from "../types";

// ── City permit portal URLs ────────────────────────────────
interface CityPortal {
  city: string;
  state: string;
  permitUrl: string;
  label: string;
}

const CITY_PORTALS: CityPortal[] = [
  {
    city: "independence",
    state: "MO",
    permitUrl: "https://www.ci.independence.mo.us/ComDev/OnlinePermits",
    label: "Independence MO — Online Permits",
  },
  {
    city: "kansas city",
    state: "MO",
    permitUrl: "https://data.kcmo.org/",
    label: "Kansas City MO — Open Data Portal",
  },
  {
    city: "lee's summit",
    state: "MO",
    permitUrl: "https://cityofls.net/development-services/building-permits",
    label: "Lee's Summit MO — Building Permits",
  },
  {
    city: "lees summit",
    state: "MO",
    permitUrl: "https://cityofls.net/development-services/building-permits",
    label: "Lee's Summit MO — Building Permits",
  },
  {
    city: "blue springs",
    state: "MO",
    permitUrl:
      "https://www.bluespringsgov.com/197/Building-Permits-Inspections",
    label: "Blue Springs MO — Building Permits",
  },
  {
    city: "overland park",
    state: "KS",
    permitUrl: "https://www.opkansas.org/building-permits/",
    label: "Overland Park KS — Building Permits",
  },
  {
    city: "olathe",
    state: "KS",
    permitUrl: "https://www.olatheks.org/government/planning/permits",
    label: "Olathe KS — Permits",
  },
];

export const permitsPlugin: DossierPlugin = {
  name: "permits",
  label: "Building Permits",
  description:
    "Searches city permit portals and code enforcement databases for building permits and violations",
  category: "property",
  enabled: true,
  priority: 65,
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

    if (!address || !city) {
      return {
        pluginName: "permits",
        success: false,
        error: "Missing address or city",
        data: {},
        sources: [],
        confidence: 0,
        warnings: [],
        durationMs: Date.now() - start,
      };
    }

    await context.updateProgress("Searching permit portals...");

    const searchLinks: string[] = [];

    // ── Match city permit portal ───────────────────────────
    const cityLower = city.toLowerCase();
    const matchedPortals = CITY_PORTALS.filter(
      (p) => p.city === cityLower && p.state === state.toUpperCase()
    );

    for (const portal of matchedPortals) {
      sources.push({
        label: portal.label,
        url: portal.permitUrl,
        type: "government",
      });
      searchLinks.push(portal.permitUrl);
    }

    if (matchedPortals.length === 0) {
      // Generic city permit search
      const genericPermitUrl = `https://www.google.com/search?q=${encodeURIComponent(
        `"${city}" "${state}" building permit search portal`
      )}`;
      sources.push({
        label: `Google: ${city} permit portal search`,
        url: genericPermitUrl,
        type: "search",
      });
      searchLinks.push(genericPermitUrl);
    }

    // ── Google: address + permit / violation ────────────────
    const permitGoogleUrl = `https://www.google.com/search?q=${encodeURIComponent(
      `"${address}" building permit code violation`
    )}`;
    sources.push({
      label: "Google: building permit + code violation search",
      url: permitGoogleUrl,
      type: "search",
    });
    searchLinks.push(permitGoogleUrl);

    // ── County code enforcement search ─────────────────────
    const assessorData = priorResults["county-assessor"]?.data || {};
    const county = (assessorData.county as string) || "";

    if (county) {
      const countyEnforcementUrl = `https://www.google.com/search?q=${encodeURIComponent(
        `"${address}" ${county} county code enforcement violation`
      )}`;
      sources.push({
        label: `Google: ${county} County code enforcement`,
        url: countyEnforcementUrl,
        type: "search",
      });
      searchLinks.push(countyEnforcementUrl);
    }

    // ── Kansas City MO Open Data specific search ───────────
    if (cityLower === "kansas city" && state.toUpperCase() === "MO") {
      const kcmoDataUrl = `https://data.kcmo.org/resource/nsn9-g4a3.json?$where=address%20like%20%27%25${encodeURIComponent(
        address.split(" ").slice(0, 3).join(" ")
      )}%25%27&$limit=20`;
      sources.push({
        label: "KCMO Open Data — Property Violations API",
        url: kcmoDataUrl,
        type: "government",
      });
    }

    // ── Independence MO specific ───────────────────────────
    if (cityLower === "independence") {
      sources.push({
        label: "Independence MO — Code Enforcement",
        url: "https://www.ci.independence.mo.us/ComDev/CodeEnforcement",
        type: "government",
      });
    }

    return {
      pluginName: "permits",
      success: true,
      data: {
        permits: [],
        codeViolations: [],
        searchLinks,
        matchedCity: matchedPortals.length > 0 ? city : null,
      },
      sources,
      confidence: 0.3,
      warnings,
      durationMs: Date.now() - start,
    };
  },
};
