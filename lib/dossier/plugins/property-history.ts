/**
 * Property History Plugin — deed history, prior sales, ownership transfers.
 *
 * Priority: 15 (runs early — useful context for other plugins)
 * Sources: County recorder sites, Google search fallback
 *
 * Finds: Prior sales, deed transfers, quit claims, trustee deeds,
 * sheriff sales, ownership duration.
 */

import type {
  DossierPlugin,
  DossierContext,
  DossierPluginResult,
  DeedRecord,
  TaxRecord,
  SourceLink,
} from "../types";

export const propertyHistoryPlugin: DossierPlugin = {
  name: "property-history",
  label: "Property & Deed History",
  description: "Searches for deed transfers, prior sales, and tax payment history",
  category: "ownership",
  enabled: true,
  priority: 15,
  estimatedDuration: "2-4 min",
  requiredConfig: [], // Public records
  dependsOn: [],

  async run(context: DossierContext): Promise<DossierPluginResult> {
    const start = Date.now();
    const { listing } = context;
    const sources: SourceLink[] = [];
    const warnings: string[] = [];
    const deedHistory: DeedRecord[] = [];
    const taxRecords: TaxRecord[] = [];

    if (!listing.address) {
      return {
        pluginName: "property-history",
        success: false,
        error: "No address available",
        data: {},
        sources: [],
        confidence: 0,
        warnings: [],
        durationMs: Date.now() - start,
      };
    }

    await context.updateProgress("Searching property transfer history...");

    const city = listing.city || "";
    const state = listing.state || "MO";
    const address = listing.address;

    // ── County recorder / deed search links ──
    if (state === "MO") {
      // Jackson County Recorder
      sources.push({
        label: "Jackson County Recorder — deed search",
        url: `https://recorder.jacksongov.org/search?searchType=address&searchString=${encodeURIComponent(address)}`,
        type: "county",
      });

      // Missouri Deeds.com (third-party aggregator)
      sources.push({
        label: "Deeds.com — MO property records",
        url: `https://www.google.com/search?q=${encodeURIComponent(
          `site:deeds.com "${address}" ${city} missouri`
        )}`,
        type: "search",
      });
    }

    if (state === "KS") {
      // Johnson County Register of Deeds
      sources.push({
        label: "Johnson County Register of Deeds",
        url: `https://countyfusion6.kofiletech.us/countyweb/loginDisplay.action?countyname=JohnsonKS`,
        type: "county",
      });
    }

    // ── Zillow price history (great for prior sales) ──
    const zillowUrl = `https://www.zillow.com/homes/${encodeURIComponent(
      `${address} ${city} ${state}`
    )}_rb/`;
    sources.push({
      label: "Zillow: price history",
      url: zillowUrl,
      type: "commercial",
    });

    // ── Redfin property history ──
    const redfinUrl = `https://www.redfin.com/search?q=${encodeURIComponent(`${address} ${city} ${state}`)}`;
    sources.push({
      label: "Redfin: property history",
      url: redfinUrl,
      type: "commercial",
    });

    // ── Realtor.com price history ──
    sources.push({
      label: "Realtor.com: price/tax history",
      url: `https://www.google.com/search?q=${encodeURIComponent(
        `site:realtor.com "${address}" ${city} ${state} price history`
      )}`,
      type: "search",
    });

    // ── Google general search for property history ──
    sources.push({
      label: "Google: property sale history",
      url: `https://www.google.com/search?q=${encodeURIComponent(
        `"${address}" ${city} ${state} property sale history deed transfer`
      )}`,
      type: "search",
    });

    // ── Tax history search ──
    if (state === "MO") {
      sources.push({
        label: "Jackson County Tax Records",
        url: `https://ascendweb.jacksongov.org/ascend/(S(0))/result.aspx?searchType=0&SearchString=${encodeURIComponent(address)}`,
        type: "county",
      });
    }
    if (state === "KS") {
      sources.push({
        label: "Johnson County Tax Records",
        url: `https://ims.jocogov.org/propertyinquiry/PropertySearch.aspx?address=${encodeURIComponent(address)}`,
        type: "county",
      });
    }

    // ── Try to scrape Zillow for price history ──
    try {
      await context.updateProgress("Checking Zillow price history...");
      // Note: Zillow blocks scraping — this is best-effort
      // In practice, the manual link above is more reliable
      const zRes = await fetch(zillowUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          Accept: "text/html",
        },
        signal: AbortSignal.timeout(10000),
      });

      if (zRes.ok) {
        const html = await zRes.text();
        // Try to extract price history from embedded JSON
        const priceHistoryMatch = html.match(/"priceHistory"\s*:\s*(\[[\s\S]*?\])/);

        if (priceHistoryMatch) {
          try {
            const history = JSON.parse(priceHistoryMatch[1]);
            for (const entry of history.slice(0, 10)) {
              if (entry.price && entry.date) {
                deedHistory.push({
                  date: entry.date,
                  price: entry.price,
                  grantor: entry.sellerAgent || "Unknown",
                  grantee: entry.buyerAgent || "Unknown",
                  type: entry.event?.toLowerCase().includes("sold") ? "warranty" : "listing",
                  sourceUrl: zillowUrl,
                });
              }
            }
          } catch {
            // JSON parse failed — not critical
          }
        }
      }
    } catch {
      // Zillow scrape failed — not critical, manual links still work
    }

    // ── Future: add county recorder API scraping ──
    // ── Future: add ATTOM Data API for detailed property history ──
    // ── Future: add DataTree / CoreLogic for title chain ──

    return {
      pluginName: "property-history",
      success: true,
      data: {
        deedHistory,
        taxRecords,
      },
      sources,
      confidence: deedHistory.length > 0 ? 0.6 : 0.3,
      warnings,
      durationMs: Date.now() - start,
    };
  },
};
