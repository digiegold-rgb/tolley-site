/**
 * AI Summary Plugin — aggregates all plugin results into a structured summary.
 *
 * Priority: 99 (runs last — uses all priorResults)
 * No external API calls — pure computation on prior plugin data.
 */

import type {
  DossierPlugin,
  DossierContext,
  DossierPluginResult,
  SourceLink,
} from "../types";

export const aiSummaryPlugin: DossierPlugin = {
  name: "ai-summary",
  label: "AI Summary",
  description:
    "Aggregates all plugin results into a structured intelligence summary with key findings and action items",
  category: "custom",
  enabled: true,
  priority: 99,
  estimatedDuration: "< 1 sec",
  requiredConfig: [],
  dependsOn: [],

  async run(context: DossierContext): Promise<DossierPluginResult> {
    const start = Date.now();
    const { listing, priorResults, knownOwners } = context;
    const sources: SourceLink[] = [];
    const warnings: string[] = [];

    await context.updateProgress("Generating intelligence summary...");

    let totalDataPoints = 0;
    const keyFindings: string[] = [];
    const actionItems: string[] = [];

    // ── Count data points across all plugins ───────────────
    for (const [pluginName, result] of Object.entries(priorResults)) {
      if (!result.success) continue;

      const data = result.data || {};
      for (const [key, value] of Object.entries(data)) {
        if (value === null || value === undefined) continue;
        if (Array.isArray(value)) {
          totalDataPoints += value.length;
        } else if (typeof value === "object") {
          totalDataPoints += Object.keys(value).length;
        } else {
          totalDataPoints++;
        }
      }

      // Also count sources as data points
      totalDataPoints += result.sources.length;
    }

    // ── Extract key findings from each plugin ──────────────

    // Owner information
    if (knownOwners.length > 0) {
      const ownerNames = knownOwners.map((o) => o.name).join(", ");
      keyFindings.push(`Identified ${knownOwners.length} owner(s): ${ownerNames}`);

      // Check for entity ownership
      for (const owner of knownOwners) {
        const nameLower = owner.name.toLowerCase();
        if (
          nameLower.includes("llc") ||
          nameLower.includes("corp") ||
          nameLower.includes("trust")
        ) {
          keyFindings.push(
            `Entity-owned property: ${owner.name} — may indicate investment/rental or asset protection`
          );
          actionItems.push(
            `Research "${owner.name}" on MO/KS SOS for officers/registered agent`
          );
        }
      }
    }

    // Court records analysis
    const courtData = priorResults["court-records"]?.data || {};
    const courtCases = (courtData.cases || []) as Array<{
      type?: string;
      status?: string;
      caseNumber?: string;
    }>;

    if (courtCases.length > 0) {
      keyFindings.push(`${courtCases.length} court case(s) found`);

      const caseTypes = courtCases.reduce<Record<string, number>>(
        (acc, c) => {
          const t = c.type || "unknown";
          acc[t] = (acc[t] || 0) + 1;
          return acc;
        },
        {}
      );

      for (const [type, count] of Object.entries(caseTypes)) {
        if (type === "divorce") {
          keyFindings.push(`Divorce filing detected — potential motivated seller`);
          actionItems.push(
            "Owner has divorce filing — approach with empathy, may need quick sale"
          );
        }
        if (type === "foreclosure") {
          keyFindings.push(`Foreclosure case found — high motivation signal`);
          actionItems.push(
            "Pre-foreclosure detected — time-sensitive, consider reaching out promptly"
          );
        }
        if (type === "eviction") {
          keyFindings.push(`${count} eviction case(s) — landlord/rental property indicator`);
          actionItems.push(
            "Eviction history suggests rental property — may be a tired landlord"
          );
        }
        if (type === "tax") {
          keyFindings.push(`Tax case found — potential tax lien or delinquency`);
          actionItems.push(
            "Tax issues detected — check for delinquent taxes, negotiate on price"
          );
        }
        if (type === "probate") {
          keyFindings.push(`Probate case found — likely inherited property`);
          actionItems.push(
            "Estate/probate detected — heirs may want quick liquidation"
          );
        }
        if (type === "bankruptcy") {
          keyFindings.push(`Bankruptcy case found`);
          actionItems.push(
            "Bankruptcy on record — may affect ability to sell, check chapter and status"
          );
        }
      }
    }

    // Financial analysis
    const financialData = priorResults["financial-analysis"]?.data || {};
    if (financialData.estimatedEquity !== undefined) {
      const equity = financialData.estimatedEquity as number;
      const equityPct = financialData.equityPercent as number;
      keyFindings.push(
        `Estimated equity: $${equity.toLocaleString()} (${equityPct}%)`
      );

      if (equityPct > 80) {
        keyFindings.push("High equity property — owner has significant financial stake");
      } else if (equityPct < 20) {
        keyFindings.push("Low equity — owner may be underwater or recently purchased");
        actionItems.push(
          "Low equity detected — may need short sale approval if selling below mortgage"
        );
      }
    }

    // Market analysis
    const marketData = priorResults["market"]?.data || {};
    if (marketData.pricePerSqft) {
      keyFindings.push(
        `Price per sqft: $${marketData.pricePerSqft}`
      );
    }
    if (marketData.priceReductionPct) {
      const pct = marketData.priceReductionPct as number;
      if (pct > 0) {
        keyFindings.push(`Price reduced ${pct}% from original list`);
        actionItems.push(
          `Price already reduced ${pct}% — seller may accept further below ask`
        );
      }
    }
    if (marketData.appreciationRate) {
      keyFindings.push(
        `Historical appreciation: ${marketData.appreciationRate}% annually`
      );
    }

    // Environmental flags
    const envData = priorResults["environmental"]?.data || {};
    if (envData.floodZone) {
      const fz = envData.floodZone as string;
      if (fz.startsWith("A") || fz.startsWith("V")) {
        keyFindings.push(`HIGH FLOOD RISK: FEMA zone ${fz}`);
        actionItems.push(
          `Property in flood zone ${fz} — flood insurance required, affects value and financing`
        );
      } else {
        keyFindings.push(`Flood zone: ${fz} (${envData.floodZoneDesc || ""})`);
      }
    }

    // Permit / code violations
    const permitData = priorResults["permits"]?.data || {};
    const codeViolations = (permitData.codeViolations || []) as Array<unknown>;
    if (codeViolations.length > 0) {
      keyFindings.push(
        `${codeViolations.length} code violation(s) found`
      );
      actionItems.push(
        "Property has code violations — negotiate on price, factor in repair costs"
      );
    }

    // Rental indicators
    const rentalData = priorResults["rental"]?.data || {};
    const rentalIndicators = (rentalData.rentalIndicators || []) as string[];
    const evictions = (rentalData.evictions || []) as Array<unknown>;

    if (rentalIndicators.length > 0) {
      keyFindings.push(
        `Rental property indicators: ${rentalIndicators.join("; ")}`
      );
    }
    if (evictions.length > 0 && !courtCases.some((c) => c.type === "eviction")) {
      keyFindings.push(`${evictions.length} eviction(s) on record`);
      actionItems.push(
        "Evictions detected — possibly tired landlord, may be motivated to sell"
      );
    }
    if (rentalData.estimatedRent) {
      const rent = rentalData.estimatedRent as {
        low: number;
        mid: number;
        high: number;
      };
      keyFindings.push(
        `Estimated rent range: $${rent.low}-$${rent.high}/mo (mid: $${rent.mid})`
      );
    }

    // Neighborhood
    const neighborhoodData = priorResults["neighborhood"]?.data || {};
    if (neighborhoodData.walkScore) {
      keyFindings.push(`Walk Score: ${neighborhoodData.walkScore}`);
    }

    // DOM analysis
    if (
      listing.daysOnMarket !== null &&
      listing.daysOnMarket !== undefined
    ) {
      if (listing.daysOnMarket > 90) {
        keyFindings.push(
          `High days on market: ${listing.daysOnMarket} days`
        );
        actionItems.push(
          `${listing.daysOnMarket} DOM — stale listing, seller likely motivated, consider low offer`
        );
      } else if (listing.daysOnMarket > 60) {
        keyFindings.push(
          `Above-average DOM: ${listing.daysOnMarket} days`
        );
      }
    }

    // Business entities
    const businessData = priorResults["business"]?.data || {};
    const businessEntities = (businessData.entities || []) as Array<{
      entityType?: string | null;
      ownerName?: string;
    }>;
    for (const ent of businessEntities) {
      if (ent.entityType) {
        keyFindings.push(
          `Business entity: ${ent.ownerName} (${ent.entityType})`
        );
      }
    }

    // ── Enhance existing research summary ──────────────────
    let enhancedSummary = "";

    // Check if DGX research worker already provided a summary
    const workerData = priorResults["dgx-research-worker"]?.data || {};
    const existingSummary = workerData.researchSummary as string | undefined;

    if (existingSummary) {
      enhancedSummary = existingSummary + "\n\n--- Plugin-Enhanced Findings ---\n\n";
    }

    // Build the summary
    if (keyFindings.length > 0) {
      enhancedSummary += `KEY FINDINGS (${keyFindings.length}):\n`;
      for (const finding of keyFindings) {
        enhancedSummary += `  - ${finding}\n`;
      }
    }

    if (actionItems.length > 0) {
      enhancedSummary += `\nACTION ITEMS (${actionItems.length}):\n`;
      for (const item of actionItems) {
        enhancedSummary += `  - ${item}\n`;
      }
    }

    enhancedSummary += `\nTotal data points gathered: ${totalDataPoints}`;
    enhancedSummary += `\nPlugins completed: ${Object.keys(priorResults).length}`;
    enhancedSummary += `\nOwners identified: ${knownOwners.length}`;

    // ── Determine overall confidence ───────────────────────
    const pluginConfidences = Object.values(priorResults)
      .filter((r) => r.success)
      .map((r) => r.confidence);
    const avgConfidence =
      pluginConfidences.length > 0
        ? pluginConfidences.reduce((a, b) => a + b, 0) /
          pluginConfidences.length
        : 0;

    return {
      pluginName: "ai-summary",
      success: true,
      data: {
        totalDataPoints,
        keyFindings,
        actionItems,
        enhancedSummary,
        pluginsRun: Object.keys(priorResults).length,
        ownersFound: knownOwners.length,
        avgPluginConfidence:
          Math.round(avgConfidence * 100) / 100,
      },
      sources,
      confidence: avgConfidence,
      warnings,
      durationMs: Date.now() - start,
    };
  },
};
