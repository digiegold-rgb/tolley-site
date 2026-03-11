/**
 * County Assessor Plugin — scrapes county assessor sites for owner names.
 *
 * Priority: 10 (runs first — everything else depends on owner names)
 * Sources: Jackson County, Clay County, Johnson County KS, etc.
 *
 * This is the foundation plugin. All people/legal lookups chain off the
 * owner names discovered here.
 */

import type { DossierPlugin, DossierContext, DossierPluginResult, OwnerInfo, SourceLink } from "../types";

// ── County assessor URL templates ───────────────────────────
// Each county has different search interfaces. We build deep links
// that the user can click to verify, and attempt to scrape owner data.

interface CountyConfig {
  name: string;
  state: "MO" | "KS";
  fips: string;
  /** URL template for address-based property search. {address}, {city}, {zip} get replaced */
  searchUrl: string;
  /** Direct parcel lookup URL template (if available) */
  parcelUrl?: string;
  /** Can we scrape this site? (some require JS rendering) */
  scrapeable: boolean;
  /** Notes for future implementation */
  notes?: string;
}

const COUNTY_CONFIGS: CountyConfig[] = [
  {
    name: "Jackson",
    state: "MO",
    fips: "29095",
    searchUrl: "https://ascendweb.jacksongov.org/ascend/(S(0))/result.aspx?searchType=0&SearchString={address}",
    scrapeable: true,
    notes: "Primary KC county. Has REST-ish search. Returns owner, legal description, assessed value.",
  },
  {
    name: "Clay",
    state: "MO",
    fips: "29047",
    searchUrl: "https://beacon.schneidercorp.com/Application.aspx?AppID=165&LayerID=2202&PageTypeID=2&PageID=1278&Q={address}",
    scrapeable: true,
    notes: "Uses Beacon/Schneider. Good owner data, assessed values.",
  },
  {
    name: "Platte",
    state: "MO",
    fips: "29165",
    searchUrl: "https://beacon.schneidercorp.com/Application.aspx?AppID=82&LayerID=1084&PageTypeID=2&PageID=540&Q={address}",
    scrapeable: true,
  },
  {
    name: "Cass",
    state: "MO",
    fips: "29037",
    searchUrl: "https://beacon.schneidercorp.com/Application.aspx?AppID=390&LayerID=5765&PageTypeID=2&PageID=3247&Q={address}",
    scrapeable: true,
  },
  {
    name: "Johnson",
    state: "KS",
    fips: "20091",
    searchUrl: "https://ims.jocogov.org/propertyinquiry/PropertySearch.aspx?address={address}",
    scrapeable: true,
    notes: "Large KS county. Good parcel data.",
  },
  {
    name: "Wyandotte",
    state: "KS",
    fips: "20209",
    searchUrl: "https://www.wycokck.org/Appraiser/Real-Property-Search?address={address}",
    scrapeable: false,
    notes: "Heavy JS rendering. May need Puppeteer.",
  },
  // ── Future counties (add as needed) ──
  // { name: "Leavenworth", state: "KS", ... },
  // { name: "Miami", state: "KS", ... },
  // { name: "Ray", state: "MO", ... },
  // { name: "Lafayette", state: "MO", ... },
];

export const countyAssessorPlugin: DossierPlugin = {
  name: "county-assessor",
  label: "County Assessor",
  description: "Looks up property owner names, assessed values, and tax status from county assessor records",
  category: "ownership",
  enabled: true,
  priority: 10,
  estimatedDuration: "2-5 min",
  requiredConfig: [], // No API keys needed — public data
  dependsOn: [],

  async run(context: DossierContext): Promise<DossierPluginResult> {
    const start = Date.now();
    const { listing } = context;
    const sources: SourceLink[] = [];
    const warnings: string[] = [];
    const owners: OwnerInfo[] = [];

    if (!listing.address || !listing.city) {
      return {
        pluginName: "county-assessor",
        success: false,
        error: "Missing address or city",
        data: {},
        sources: [],
        confidence: 0,
        warnings: [],
        durationMs: Date.now() - start,
      };
    }

    await context.updateProgress("Identifying county...");

    // Detect county from existing enrichment or lat/lng
    const countyConfig = detectCountyConfig(listing);

    if (!countyConfig) {
      // Can't determine county — provide general search links
      const genericSearchUrl = `https://www.google.com/search?q=${encodeURIComponent(
        `"${listing.address}" ${listing.city} ${listing.state || "MO"} property owner county assessor`
      )}`;

      sources.push({
        label: `Google: property owner search`,
        url: genericSearchUrl,
        type: "search",
      });

      warnings.push("Could not determine county — providing Google search link instead");

      return {
        pluginName: "county-assessor",
        success: true,
        data: { owners: [], searchLinks: [genericSearchUrl] },
        sources,
        confidence: 0.1,
        warnings,
        durationMs: Date.now() - start,
      };
    }

    await context.updateProgress(`Searching ${countyConfig.name} County assessor...`);

    // Build search URL
    const searchUrl = countyConfig.searchUrl
      .replace("{address}", encodeURIComponent(listing.address.replace(/,.*$/, "").trim()))
      .replace("{city}", encodeURIComponent(listing.city))
      .replace("{zip}", encodeURIComponent(listing.zip || ""));

    sources.push({
      label: `${countyConfig.name} County Assessor — Property Search`,
      url: searchUrl,
      type: "county",
    });

    // Attempt to scrape owner data
    let rawEntityName: string | null = null;
    let assessedValue: number | null = null;

    if (countyConfig.scrapeable) {
      try {
        await context.updateProgress(`Scraping ${countyConfig.name} County records...`);
        const scrapeResult = await scrapeAssessor(searchUrl, countyConfig);
        if (scrapeResult) {
          rawEntityName = scrapeResult.ownerName;
          assessedValue = scrapeResult.assessedValue;

          // Parse owner name(s) from raw entity
          const parsed = parseOwnerName(scrapeResult.ownerName);
          for (const p of parsed) {
            owners.push({
              ...p,
              sourceUrl: searchUrl,
              confidence: 0.8,
            });
          }

          if (scrapeResult.mailingAddress) {
            // Check if mailing address differs from property (absentee owner indicator)
            const propertyAddr = listing.address.toLowerCase();
            const mailingAddr = scrapeResult.mailingAddress.toLowerCase();
            if (!mailingAddr.includes(propertyAddr.split(" ")[1] || "NOMATCH")) {
              warnings.push("Mailing address differs from property — possible absentee owner");
              if (owners.length > 0) {
                owners[0].address = scrapeResult.mailingAddress;
              }
            }
          }
        }
      } catch (err) {
        warnings.push(`Scrape failed: ${err instanceof Error ? err.message : "unknown error"}. Use the link above to check manually.`);
      }
    } else {
      warnings.push(`${countyConfig.name} County requires JavaScript rendering — click the link to search manually`);
    }

    // If scraping didn't work, try a fallback Google search for owner
    if (owners.length === 0) {
      await context.updateProgress("Trying Google fallback for owner info...");
      const googleUrl = `https://www.google.com/search?q=${encodeURIComponent(
        `"${listing.address}" ${listing.city} ${listing.state || "MO"} owner name property records`
      )}`;

      sources.push({
        label: "Google: property owner search (fallback)",
        url: googleUrl,
        type: "search",
      });

      // Also add county recorder / tax search links
      const taxSearchUrl = buildTaxSearchUrl(countyConfig, listing);
      if (taxSearchUrl) {
        sources.push({
          label: `${countyConfig.name} County Tax Records`,
          url: taxSearchUrl,
          type: "county",
        });
      }
    }

    return {
      pluginName: "county-assessor",
      success: true,
      data: {
        owners,
        rawEntityName,
        assessedValue,
        county: countyConfig.name,
        countyState: countyConfig.state,
        countyFips: countyConfig.fips,
      },
      sources,
      confidence: owners.length > 0 ? 0.8 : 0.3,
      warnings,
      durationMs: Date.now() - start,
    };
  },
};

// ── Internal helpers ────────────────────────────────────────

function detectCountyConfig(listing: { city: string | null; state: string | null; zip: string | null }): CountyConfig | null {
  const city = listing.city?.toLowerCase() || "";
  const zip = listing.zip || "";
  const state = listing.state?.toUpperCase() || "MO";

  // Zip-based detection (most reliable)
  const MO_JACKSON_ZIPS = ["64050", "64052", "64053", "64054", "64055", "64056", "64057", "64058",
    "64014", "64015", "64029", "64030", "64034", "64064", "64065", "64081", "64082", "64083",
    "64086", "64133", "64134", "64136", "64137", "64138", "64139", "64145", "64146", "64147",
    "64149", "64150", "64151", "64152", "64153", "64154", "64155", "64156", "64157", "64158",
    "64101", "64102", "64105", "64106", "64108", "64109", "64110", "64111", "64112", "64113",
    "64114", "64116", "64117", "64118", "64119", "64120", "64121", "64123", "64124", "64125",
    "64126", "64127", "64128", "64129", "64130", "64131", "64132"];
  const MO_CLAY_ZIPS = ["64068", "64079", "64060", "64024", "64048", "64061", "64074",
    "64116", "64117", "64118", "64119", "64151", "64152", "64153", "64154", "64155",
    "64156", "64157", "64158"];
  const MO_PLATTE_ZIPS = ["64079", "64098", "64153", "64154", "64155", "64163", "64164", "64165"];
  const KS_JOHNSON_ZIPS = ["66061", "66062", "66202", "66203", "66204", "66205", "66206",
    "66207", "66208", "66209", "66210", "66211", "66212", "66213", "66214", "66215",
    "66216", "66217", "66218", "66219", "66220", "66221", "66222", "66223", "66224",
    "66226", "66227", "66250", "66251", "66282", "66283", "66285", "66286"];
  const KS_WYANDOTTE_ZIPS = ["66101", "66102", "66103", "66104", "66105", "66106",
    "66109", "66111", "66112", "66113", "66115", "66117", "66118", "66119"];

  if (KS_JOHNSON_ZIPS.includes(zip)) return COUNTY_CONFIGS.find((c) => c.name === "Johnson")!;
  if (KS_WYANDOTTE_ZIPS.includes(zip)) return COUNTY_CONFIGS.find((c) => c.name === "Wyandotte")!;
  if (MO_PLATTE_ZIPS.includes(zip)) return COUNTY_CONFIGS.find((c) => c.name === "Platte")!;
  if (MO_CLAY_ZIPS.includes(zip)) return COUNTY_CONFIGS.find((c) => c.name === "Clay")!;
  if (MO_JACKSON_ZIPS.includes(zip)) return COUNTY_CONFIGS.find((c) => c.name === "Jackson")!;

  // City-based fallback
  if (["independence", "blue springs", "lees summit", "lee's summit", "raytown", "grandview"].includes(city))
    return COUNTY_CONFIGS.find((c) => c.name === "Jackson")!;
  if (["liberty", "kearney", "excelsior springs", "gladstone", "north kansas city"].includes(city))
    return COUNTY_CONFIGS.find((c) => c.name === "Clay")!;
  if (["overland park", "olathe", "lenexa", "shawnee", "leawood", "prairie village", "merriam"].includes(city))
    return COUNTY_CONFIGS.find((c) => c.name === "Johnson")!;

  // State fallback — default to largest county in state
  if (state === "KS") return COUNTY_CONFIGS.find((c) => c.name === "Johnson")!;
  return COUNTY_CONFIGS.find((c) => c.name === "Jackson")!;
}

async function scrapeAssessor(
  url: string,
  config: CountyConfig
): Promise<{ ownerName: string; assessedValue: number | null; mailingAddress: string | null } | null> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; T-Agent Research/1.0)",
        Accept: "text/html",
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) return null;
    const html = await res.text();

    // ── Jackson County parser ──
    if (config.name === "Jackson") {
      return parseJacksonCounty(html);
    }

    // ── Beacon/Schneider parser (Clay, Platte, Cass) ──
    if (config.name === "Clay" || config.name === "Platte" || config.name === "Cass") {
      return parseBeaconSite(html);
    }

    // ── Johnson County KS parser ──
    if (config.name === "Johnson") {
      return parseJohnsonCounty(html);
    }

    return null;
  } catch {
    return null;
  }
}

function parseJacksonCounty(html: string): { ownerName: string; assessedValue: number | null; mailingAddress: string | null } | null {
  // Look for owner name patterns in Jackson County HTML
  const ownerMatch = html.match(/Owner[:\s]*<[^>]*>([^<]+)</i) ||
                     html.match(/OWNER[:\s]*([A-Z][A-Z\s,&]+)/);
  if (!ownerMatch) return null;

  const assessedMatch = html.match(/Assessed[:\s]*\$?([\d,]+)/i);
  const mailingMatch = html.match(/Mailing[:\s]*<[^>]*>([^<]+)/i);

  return {
    ownerName: ownerMatch[1].trim(),
    assessedValue: assessedMatch ? parseInt(assessedMatch[1].replace(/,/g, "")) : null,
    mailingAddress: mailingMatch ? mailingMatch[1].trim() : null,
  };
}

function parseBeaconSite(html: string): { ownerName: string; assessedValue: number | null; mailingAddress: string | null } | null {
  const ownerMatch = html.match(/Owner(?:\s*Name)?[:\s]*<[^>]*>([^<]+)/i) ||
                     html.match(/"OwnerName"\s*:\s*"([^"]+)"/);
  if (!ownerMatch) return null;

  const assessedMatch = html.match(/Assessed\s*(?:Value)?[:\s]*\$?([\d,]+)/i);
  const mailingMatch = html.match(/Mailing\s*Address[:\s]*<[^>]*>([^<]+)/i);

  return {
    ownerName: ownerMatch[1].trim(),
    assessedValue: assessedMatch ? parseInt(assessedMatch[1].replace(/,/g, "")) : null,
    mailingAddress: mailingMatch ? mailingMatch[1].trim() : null,
  };
}

function parseJohnsonCounty(html: string): { ownerName: string; assessedValue: number | null; mailingAddress: string | null } | null {
  const ownerMatch = html.match(/Owner[:\s]*<[^>]*>([^<]+)/i) ||
                     html.match(/OWNER[:\s]*([A-Z][A-Z\s,&]+)/);
  if (!ownerMatch) return null;

  const assessedMatch = html.match(/Appraised[:\s]*\$?([\d,]+)/i);
  const mailingMatch = html.match(/Mailing[:\s]*<[^>]*>([^<]+)/i);

  return {
    ownerName: ownerMatch[1].trim(),
    assessedValue: assessedMatch ? parseInt(assessedMatch[1].replace(/,/g, "")) : null,
    mailingAddress: mailingMatch ? mailingMatch[1].trim() : null,
  };
}

function parseOwnerName(raw: string): OwnerInfo[] {
  const owners: OwnerInfo[] = [];
  const cleaned = raw.trim();

  // Check for trust/LLC/entity
  const lower = cleaned.toLowerCase();
  if (lower.includes("trust") || lower.includes("llc") || lower.includes("corp") || lower.includes("inc") || lower.includes("estate")) {
    // Entity — try to extract trustee or registered agent name
    const trusteeMatch = cleaned.match(/(?:trustee|tr)[:\s]+([A-Za-z]+\s+[A-Za-z]+)/i);
    if (trusteeMatch) {
      owners.push({ name: trusteeMatch[1].trim(), role: "trustee", confidence: 0.7 });
    }
    // Also add the entity itself
    owners.push({ name: cleaned, role: "owner", confidence: 0.9 });
    return owners;
  }

  // Check for joint owners: "SMITH JOHN A & SMITH JANE B" or "John Smith and Jane Smith"
  const ampersandParts = cleaned.split(/\s*[&]\s*/);
  if (ampersandParts.length === 2) {
    // Joint ownership
    const name1 = normalizePersonName(ampersandParts[0]);
    const name2 = normalizePersonName(ampersandParts[1]);

    // If second part is just a first name, they share the last name
    if (name2.split(" ").length === 1 && name1.includes(" ")) {
      const lastName = name1.split(" ").pop()!;
      owners.push({ name: name1, role: "owner", confidence: 0.8 });
      owners.push({ name: `${name2} ${lastName}`, role: "co-owner", confidence: 0.7 });
    } else {
      owners.push({ name: name1, role: "owner", confidence: 0.8 });
      owners.push({ name: name2, role: "co-owner", confidence: 0.8 });
    }
    return owners;
  }

  // Single owner
  owners.push({ name: normalizePersonName(cleaned), role: "owner", confidence: 0.8 });
  return owners;
}

function normalizePersonName(raw: string): string {
  // Convert "SMITH JOHN A" → "John A Smith" (LAST FIRST MI → FIRST MI LAST)
  const parts = raw.trim().split(/\s+/);
  if (parts.length >= 2 && parts[0] === parts[0].toUpperCase() && parts[0].length > 1) {
    // Likely LAST FIRST format (all caps)
    const lastName = parts[0];
    const rest = parts.slice(1);
    return [...rest, lastName]
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
      .join(" ");
  }
  // Already in First Last format or mixed
  return parts
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
    .join(" ");
}

function buildTaxSearchUrl(config: CountyConfig, listing: { address: string; city: string | null }): string | null {
  if (config.state === "MO") {
    // Missouri county collector/treasurer
    return `https://www.google.com/search?q=${encodeURIComponent(
      `${config.name} county missouri tax collector property search "${listing.address}"`
    )}`;
  }
  if (config.state === "KS") {
    return `https://www.google.com/search?q=${encodeURIComponent(
      `${config.name} county kansas treasurer property tax "${listing.address}"`
    )}`;
  }
  return null;
}
