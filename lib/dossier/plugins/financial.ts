/**
 * Financial Analysis Plugin — mortgage estimate, equity calculation.
 *
 * Priority: 60 (runs after county-assessor + property-history)
 * No external API calls — pure computation on prior plugin data.
 */

import type {
  DossierPlugin,
  DossierContext,
  DossierPluginResult,
  SourceLink,
} from "../types";
import { estimateEquity } from "@/lib/snap/equity";

export const financialPlugin: DossierPlugin = {
  name: "financial-analysis",
  label: "Financial Analysis",
  description: "Estimates mortgage balance, property equity, and financial indicators",
  category: "financial",
  enabled: true,
  priority: 60,
  estimatedDuration: "< 1 sec",
  requiredConfig: [], // Pure computation, no API keys
  dependsOn: ["county-assessor", "property-history"],

  async run(context: DossierContext): Promise<DossierPluginResult> {
    const start = Date.now();
    const { listing, priorResults } = context;
    const sources: SourceLink[] = [];
    const warnings: string[] = [];

    await context.updateProgress("Calculating equity estimate...");

    // Gather data from prior plugins
    const assessorData = priorResults["county-assessor"]?.data || {};
    const historyData = priorResults["property-history"]?.data || {};
    const workerData = priorResults["dgx-research-worker"]?.data || {};
    const narrprData = priorResults["narrpr-import"]?.data || {};

    const result = estimateEquity({
      zestimate: workerData.zestimate as number | undefined,
      refdinEstimate: workerData.redfin_estimate as number | undefined,
      marketValue: assessorData.marketValue as number | undefined,
      assessedValue: assessorData.assessedValue as number | undefined,
      assessmentRatio: undefined, // Will use enrichment data if available
      listPrice: listing.listPrice ?? undefined,
      deedHistory: (historyData.deedHistory || narrprData.deedHistory || []) as Array<{ price?: number | null; date?: string }>,
      // NARRPR data: actual mortgage + MLS-informed RVM valuation
      narrprMortgage: narrprData.narrprMortgage as { amount: number; date: string; lender: string; type: string; rate?: number } | undefined,
      narrprRvm: narrprData.narrprRvm as { value: number; confidence: number; low?: number; high?: number } | undefined,
    });

    if (!result) {
      warnings.push("Insufficient data for equity estimation — need market value or list price");
      return {
        pluginName: "financial-analysis",
        success: true,
        data: {},
        sources,
        confidence: 0,
        warnings,
        durationMs: Date.now() - start,
      };
    }

    // Add source links for verification
    if (result.marketValueSource.includes("Zillow")) {
      sources.push({
        label: "Zillow Zestimate (market value source)",
        url: `https://www.zillow.com/homes/${encodeURIComponent(`${listing.address} ${listing.city || ""} ${listing.state || "MO"}`)}_rb/`,
        type: "commercial",
      });
    }
    if (result.marketValueSource.includes("Redfin")) {
      sources.push({
        label: "Redfin Estimate (market value source)",
        url: `https://www.redfin.com/search?q=${encodeURIComponent(`${listing.address} ${listing.city || ""} ${listing.state || "MO"}`)}`,
        type: "commercial",
      });
    }

    return {
      pluginName: "financial-analysis",
      success: true,
      data: {
        estimatedEquity: result.equityEstimate,
        equityPercent: result.equityPercent,
        marketValue: result.marketValue,
        marketValueSource: result.marketValueSource,
        mortgageEstimate: result.mortgageEstimate,
        mortgageMethod: result.mortgageMethod,
        confidence: result.confidence,
        financialData: result, // Full breakdown for DossierResult.financialData
      },
      sources,
      confidence: result.confidence === "high" ? 0.8 : result.confidence === "medium" ? 0.6 : 0.3,
      warnings,
      durationMs: Date.now() - start,
    };
  },
};
