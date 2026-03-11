/**
 * Neighborhood Stats Plugin — walk score, schools, crime, demographics.
 *
 * Priority: 55 (independent — no dependencies)
 * Sources: Walk Score, GreatSchools, CrimeMapping, NeighborhoodScout, City-Data, Niche
 */

import type {
  DossierPlugin,
  DossierContext,
  DossierPluginResult,
  SourceLink,
} from "../types";

export const neighborhoodPlugin: DossierPlugin = {
  name: "neighborhood",
  label: "Neighborhood Stats",
  description:
    "Gathers walk score, school ratings, crime stats, and neighborhood demographics from public sources",
  category: "neighborhood",
  enabled: true,
  priority: 55,
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

    if (!address || !city) {
      return {
        pluginName: "neighborhood",
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

    await context.updateProgress("Looking up Walk Score...");

    // ── Walk Score ──────────────────────────────────────────
    let walkScore: number | null = null;
    let transitScore: number | null = null;
    const walkScoreUrl = `https://www.walkscore.com/score/${encodeURIComponent(
      `${address} ${city} ${state} ${zip}`
    )}`;

    try {
      const res = await fetch(walkScoreUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; T-Agent Research/1.0)",
          Accept: "text/html",
        },
        signal: AbortSignal.timeout(10000),
      });

      if (res.ok) {
        const html = await res.text();

        // Try JSON-LD or embedded score data
        const wsMatch =
          html.match(/"walkscore"\s*:\s*(\d+)/i) ||
          html.match(/walk-score[^>]*>(\d+)</) ||
          html.match(/Walk Score[^<]*<[^>]*>(\d+)/) ||
          html.match(/"score"\s*:\s*(\d+)/);
        if (wsMatch) {
          walkScore = parseInt(wsMatch[1], 10);
        }

        const tsMatch =
          html.match(/"transit_score"\s*:\s*(\d+)/i) ||
          html.match(/transit-score[^>]*>(\d+)</) ||
          html.match(/Transit Score[^<]*<[^>]*>(\d+)/);
        if (tsMatch) {
          transitScore = parseInt(tsMatch[1], 10);
        }
      }
    } catch {
      warnings.push(
        "Walk Score fetch failed — link provided for manual lookup"
      );
    }

    sources.push({
      label: `Walk Score — ${address}`,
      url: walkScoreUrl,
      type: "commercial",
      fetchedAt: new Date().toISOString(),
    });

    await context.updateProgress("Building neighborhood research links...");

    // ── GreatSchools ───────────────────────────────────────
    const greatSchoolsUrl = `https://www.greatschools.org/search/search.page?q=${encodeURIComponent(
      `${address}, ${city}, ${state}`
    )}`;
    sources.push({
      label: "GreatSchools — Nearby Schools",
      url: greatSchoolsUrl,
      type: "commercial",
    });

    // ── CrimeMapping ───────────────────────────────────────
    const crimeMappingUrl = `https://www.crimemapping.com/map/location/${encodeURIComponent(
      `${city}, ${state}`
    )}`;
    sources.push({
      label: `CrimeMapping — ${city}`,
      url: crimeMappingUrl,
      type: "other",
    });

    // ── NeighborhoodScout ──────────────────────────────────
    const neighborhoodScoutUrl = `https://www.neighborhoodscout.com/${state
      .toLowerCase()}/${city.toLowerCase().replace(/ /g, "-")}`;
    sources.push({
      label: `NeighborhoodScout — ${city}`,
      url: neighborhoodScoutUrl,
      type: "commercial",
    });

    // ── City-Data ──────────────────────────────────────────
    const cityDataUrl = `http://www.city-data.com/city/${city.replace(
      / /g,
      "-"
    )}-${state}.html`;
    sources.push({
      label: `City-Data — ${city}, ${state}`,
      url: cityDataUrl,
      type: "other",
    });

    // ── Niche ──────────────────────────────────────────────
    const nicheUrl = `https://www.niche.com/places-to-live/search/best-neighborhoods/?q=${encodeURIComponent(
      `${city}, ${state}`
    )}`;
    sources.push({
      label: `Niche — Best Neighborhoods in ${city}`,
      url: nicheUrl,
      type: "commercial",
    });

    // ── Build result ───────────────────────────────────────
    const neighborhoodLinks = [
      neighborhoodScoutUrl,
      cityDataUrl,
      nicheUrl,
    ];
    const crimeLinks = [crimeMappingUrl];

    const confidence =
      walkScore !== null ? 0.7 : 0.3;

    return {
      pluginName: "neighborhood",
      success: true,
      data: {
        walkScore,
        transitScore,
        schools: [],
        crimeLinks,
        neighborhoodLinks,
      },
      sources,
      confidence,
      warnings,
      durationMs: Date.now() - start,
    };
  },
};
