/**
 * Market Comps Plugin — price analytics, appreciation, market context.
 *
 * Priority: 85 (runs after county-assessor + property-history)
 * No external API calls — pure computation on listing data + prior results.
 */

import type {
  DossierPlugin,
  DossierContext,
  DossierPluginResult,
  SourceLink,
} from "../types";

export const marketPlugin: DossierPlugin = {
  name: "market",
  label: "Market Comps",
  description:
    "Computes price per sqft, assessed-vs-list ratio, appreciation rate, and links to market trend sources",
  category: "market",
  enabled: true,
  priority: 85,
  estimatedDuration: "< 1 sec",
  requiredConfig: [],
  dependsOn: ["county-assessor", "property-history"],

  async run(context: DossierContext): Promise<DossierPluginResult> {
    const start = Date.now();
    const { listing, priorResults } = context;
    const sources: SourceLink[] = [];
    const warnings: string[] = [];

    const city = listing.city || "";
    const state = listing.state || "MO";

    await context.updateProgress("Computing market analytics...");

    const computedMetrics: Record<string, unknown> = {};
    const marketLinks: string[] = [];

    // ── Price per sqft ─────────────────────────────────────
    let pricePerSqft: number | null = null;
    if (listing.listPrice && listing.sqft && listing.sqft > 0) {
      pricePerSqft = Math.round(
        (listing.listPrice / listing.sqft) * 100
      ) / 100;
      computedMetrics.pricePerSqft = pricePerSqft;
    }

    // ── Assessed vs List ratio ─────────────────────────────
    let assessedVsListRatio: number | null = null;
    const assessorData = priorResults["county-assessor"]?.data || {};
    const assessedValue = assessorData.assessedValue as number | undefined;
    // Try marketValue from assessor data (some counties provide both)
    const marketValue = (assessorData.marketValue as number | undefined) ||
      (assessedValue ? assessedValue * 3.33 : undefined); // MO assessment ratio ~30% → market ≈ assessed × 3.33

    if (listing.listPrice && marketValue && marketValue > 0) {
      assessedVsListRatio =
        Math.round((listing.listPrice / marketValue) * 1000) / 1000;
      computedMetrics.assessedVsListRatio = assessedVsListRatio;
      computedMetrics.derivedMarketValue = marketValue;

      if (assessedVsListRatio > 1.2) {
        warnings.push(
          `List price is ${Math.round(
            (assessedVsListRatio - 1) * 100
          )}% above derived market value — potentially overpriced`
        );
      } else if (assessedVsListRatio < 0.8) {
        warnings.push(
          `List price is ${Math.round(
            (1 - assessedVsListRatio) * 100
          )}% below derived market value — potential deal or condition issues`
        );
      }
    }

    // ── Appreciation rate from deed history ─────────────────
    let appreciationRate: number | null = null;
    const historyData = priorResults["property-history"]?.data || {};
    const deedHistory = (historyData.deedHistory || []) as Array<{
      price?: number | null;
      date?: string;
    }>;

    // Filter deeds with valid sale prices, sort by date
    const salesWithPrices = deedHistory
      .filter((d) => d.price && d.price > 0 && d.date)
      .sort(
        (a, b) =>
          new Date(a.date!).getTime() - new Date(b.date!).getTime()
      );

    if (salesWithPrices.length >= 2) {
      const first = salesWithPrices[0];
      const last = salesWithPrices[salesWithPrices.length - 1];
      const years =
        (new Date(last.date!).getTime() -
          new Date(first.date!).getTime()) /
        (365.25 * 24 * 60 * 60 * 1000);

      if (years > 0 && first.price! > 0) {
        // Compound annual growth rate
        appreciationRate =
          Math.round(
            (Math.pow(last.price! / first.price!, 1 / years) - 1) *
              10000
          ) / 100;
        computedMetrics.appreciationRate = appreciationRate;
        computedMetrics.appreciationYears = Math.round(years * 10) / 10;
        computedMetrics.firstSalePrice = first.price;
        computedMetrics.firstSaleDate = first.date;
        computedMetrics.lastSalePrice = last.price;
        computedMetrics.lastSaleDate = last.date;
      }
    }

    // ── Price reduction ────────────────────────────────────
    let priceReductionPct: number | null = null;
    if (
      listing.originalListPrice &&
      listing.listPrice &&
      listing.originalListPrice !== listing.listPrice
    ) {
      priceReductionPct =
        Math.round(
          ((listing.originalListPrice - listing.listPrice) /
            listing.originalListPrice) *
            10000
        ) / 100;
      computedMetrics.priceReductionPct = priceReductionPct;
      computedMetrics.originalListPrice = listing.originalListPrice;

      if (priceReductionPct > 0) {
        warnings.push(
          `Price reduced ${priceReductionPct}% from $${listing.originalListPrice.toLocaleString()} to $${listing.listPrice.toLocaleString()}`
        );
      } else {
        warnings.push(
          `Price increased ${Math.abs(priceReductionPct)}% from $${listing.originalListPrice.toLocaleString()} to $${listing.listPrice.toLocaleString()}`
        );
      }
    }

    // ── Days on market context ─────────────────────────────
    if (listing.daysOnMarket !== null && listing.daysOnMarket !== undefined) {
      computedMetrics.daysOnMarket = listing.daysOnMarket;
      // KC metro average DOM is roughly 30-45 days for a healthy market
      if (listing.daysOnMarket > 90) {
        warnings.push(
          `High DOM: ${listing.daysOnMarket} days — significantly above KC metro average (~30-45 days)`
        );
      } else if (listing.daysOnMarket > 60) {
        warnings.push(
          `Elevated DOM: ${listing.daysOnMarket} days — above KC metro average`
        );
      }
    }

    await context.updateProgress("Building market research links...");

    // ── Realtor.com market trends ──────────────────────────
    if (city) {
      const realtorUrl = `https://www.realtor.com/realestateandhomes-search/${city.replace(
        / /g,
        "-"
      )}_${state}/overview`;
      sources.push({
        label: `Realtor.com — ${city} Market Overview`,
        url: realtorUrl,
        type: "commercial",
      });
      marketLinks.push(realtorUrl);
    }

    // ── Zillow market overview ─────────────────────────────
    if (city) {
      const zillowUrl = `https://www.zillow.com/${city
        .toLowerCase()
        .replace(/ /g, "-")}-${state.toLowerCase()}/home-values/`;
      sources.push({
        label: `Zillow — ${city} Home Values`,
        url: zillowUrl,
        type: "commercial",
      });
      marketLinks.push(zillowUrl);
    }

    // ── Redfin market data ─────────────────────────────────
    if (city) {
      const redfinUrl = `https://www.redfin.com/city/${encodeURIComponent(
        city
      )}/${state}/housing-market`;
      sources.push({
        label: `Redfin — ${city} Housing Market`,
        url: redfinUrl,
        type: "commercial",
      });
      marketLinks.push(redfinUrl);
    }

    // ── Heartland MLS stats ────────────────────────────────
    const heartlandUrl = `https://www.heartlandmls.com/`;
    sources.push({
      label: "Heartland MLS — Market Statistics",
      url: heartlandUrl,
      type: "commercial",
    });
    marketLinks.push(heartlandUrl);

    // ── FRED economic data for KC metro ────────────────────
    const fredUrl = `https://fred.stlouisfed.org/series/ATNHPIUS28140Q`;
    sources.push({
      label: "FRED — KC Metro Home Price Index",
      url: fredUrl,
      type: "government",
    });
    marketLinks.push(fredUrl);

    // ── Compute confidence ─────────────────────────────────
    let metricsCount = 0;
    if (pricePerSqft !== null) metricsCount++;
    if (assessedVsListRatio !== null) metricsCount++;
    if (appreciationRate !== null) metricsCount++;
    if (priceReductionPct !== null) metricsCount++;

    const confidence = Math.min(0.9, 0.3 + metricsCount * 0.15);

    return {
      pluginName: "market",
      success: true,
      data: {
        pricePerSqft,
        assessedVsListRatio,
        appreciationRate,
        priceReductionPct,
        marketLinks,
        computedMetrics,
      },
      sources,
      confidence,
      warnings,
      durationMs: Date.now() - start,
    };
  },
};
