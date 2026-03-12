import type {
  DossierPlugin,
  DossierContext,
  DossierPluginResult,
  SourceLink,
} from "../types";

interface PropertyMetrics {
  address: string | null;
  listPrice: number | null;
  assessedValue: number | null;
  marketValue: number | null;
  estimatedEquity: number | null;
  yearBuilt: number | null;
  sqft: number | null;
  beds: number | null;
  baths: number | null;
  daysOnMarket: number | null;
}

interface OwnerMetrics {
  ownerCount: number;
  hasPhone: boolean;
  hasEmail: boolean;
  hasSocial: boolean;
  entityType: "individual" | "llc" | "trust" | "estate" | null;
}

interface MotivationMetrics {
  flagCount: number;
  flags: string[];
  motivationScore: number | null;
}

interface DataQuality {
  pluginsRan: number;
  pluginsSucceeded: number;
  pluginsFailed: number;
  averageConfidence: number;
  sourcesCount: number;
}

interface FinancialMetrics {
  mortgageBalance: number | null;
  equity: number | null;
  taxAmount: number | null;
  unclaimedFundsTotal: number | null;
}

interface NeighborhoodMetrics {
  walkScore: number | null;
  crimeIndex: number | null;
  schoolRating: number | null;
}

interface MarketMetrics {
  medianPricePerSqft: number | null;
  marketTrend: string | null;
  absorptionRate: number | null;
}

interface CrossVerification {
  overallConfidence: number | null;
}

interface AnalyticsPayload {
  propertyMetrics: PropertyMetrics;
  ownerMetrics: OwnerMetrics;
  motivationMetrics: MotivationMetrics;
  dataQuality: DataQuality;
  financialMetrics: FinancialMetrics;
  neighborhoodMetrics: NeighborhoodMetrics;
  marketMetrics: MarketMetrics;
  crossVerification: CrossVerification;
  timestamp: string;
}

function detectEntityType(name: string): OwnerMetrics["entityType"] {
  const lower = name.toLowerCase();
  if (lower.includes("trust")) return "trust";
  if (lower.includes("estate") || lower.includes("probate")) return "estate";
  if (
    lower.includes("llc") ||
    lower.includes("l.l.c") ||
    lower.includes("corp") ||
    lower.includes("inc")
  )
    return "llc";
  return "individual";
}

function extractMotivationFlags(
  priorResults: Record<string, DossierPluginResult>
): string[] {
  const flags: string[] = [];

  const summaryData = priorResults["ai-summary"]?.data || {};
  const keyFindings = (summaryData.keyFindings || []) as string[];
  const actionItems = (summaryData.actionItems || []) as string[];

  const flagPatterns: [RegExp, string][] = [
    [/divorce/i, "divorce"],
    [/foreclosure|pre.?foreclosure/i, "pre_foreclosure"],
    [/bankruptcy/i, "bankruptcy"],
    [/tax\s*(lien|case|issue|delinquen)/i, "tax_lien"],
    [/probate|estate/i, "estate_probate"],
    [/code\s*violation/i, "code_violation"],
    [/vacant/i, "vacant"],
    [/out.?of.?state/i, "out_of_state_owner"],
    [/tired\s*landlord/i, "tired_landlord"],
    [/eviction/i, "tired_landlord"],
    [/high\s*(dom|days\s*on\s*market)/i, "high_dom"],
    [/price\s*(reduced|drop|cut)/i, "price_drop"],
    [/inherited/i, "inherited"],
    [/absentee/i, "absentee_owner"],
  ];

  const combined = [...keyFindings, ...actionItems].join(" ");
  for (const [pattern, flag] of flagPatterns) {
    if (pattern.test(combined) && !flags.includes(flag)) {
      flags.push(flag);
    }
  }

  return flags;
}

function countPopulatedMetrics(payload: AnalyticsPayload): number {
  let count = 0;

  for (const val of Object.values(payload.propertyMetrics)) {
    if (val !== null && val !== undefined) count++;
  }
  count += payload.ownerMetrics.ownerCount > 0 ? 1 : 0;
  count += payload.ownerMetrics.hasPhone ? 1 : 0;
  count += payload.ownerMetrics.hasEmail ? 1 : 0;
  count += payload.ownerMetrics.hasSocial ? 1 : 0;
  count += payload.ownerMetrics.entityType ? 1 : 0;
  count += payload.motivationMetrics.flagCount;
  count += payload.motivationMetrics.motivationScore !== null ? 1 : 0;
  for (const val of Object.values(payload.financialMetrics)) {
    if (val !== null && val !== undefined) count++;
  }
  for (const val of Object.values(payload.neighborhoodMetrics)) {
    if (val !== null && val !== undefined) count++;
  }
  for (const val of Object.values(payload.marketMetrics)) {
    if (val !== null && val !== undefined) count++;
  }
  count += payload.crossVerification.overallConfidence !== null ? 1 : 0;

  return count;
}

export const analyticsExportPlugin: DossierPlugin = {
  name: "analytics-export",
  label: "Analytics Export",
  description:
    "Extracts key metrics from all prior results into structured analytics format",
  category: "custom",
  enabled: true,
  priority: 98,
  estimatedDuration: "< 1 sec",
  requiredConfig: [],
  dependsOn: ["ai-summary"],

  async run(context: DossierContext): Promise<DossierPluginResult> {
    const start = Date.now();
    const { listing, priorResults, knownOwners } = context;
    const warnings: string[] = [];

    await context.updateProgress("Extracting analytics metrics...");

    const assessorData = priorResults["county-assessor"]?.data || {};
    const financialData = priorResults["financial-analysis"]?.data || {};
    const neighborhoodData = priorResults["neighborhood"]?.data || {};
    const marketData = priorResults["market"]?.data || {};
    const unclaimedData = priorResults["unclaimed-funds"]?.data || {};
    const summaryData = priorResults["ai-summary"]?.data || {};
    const crossVerifyData = priorResults["cross-verify"]?.data || {};

    // -- Property Metrics --
    const propertyMetrics: PropertyMetrics = {
      address: listing.address || null,
      listPrice: listing.listPrice ?? null,
      assessedValue: (assessorData.assessedValue as number) ?? null,
      marketValue: (financialData.marketValue as number) ?? null,
      estimatedEquity: (financialData.estimatedEquity as number) ?? null,
      yearBuilt: (assessorData.yearBuilt as number) ?? null,
      sqft: listing.sqft ?? null,
      beds: listing.beds ?? null,
      baths: listing.baths ?? null,
      daysOnMarket: listing.daysOnMarket ?? null,
    };

    // -- Owner Metrics --
    let entityType: OwnerMetrics["entityType"] = null;
    if (knownOwners.length > 0) {
      entityType = detectEntityType(knownOwners[0].name);
    }
    const rawEntityName = assessorData.rawEntityName as string | undefined;
    if (!entityType && rawEntityName) {
      entityType = detectEntityType(rawEntityName);
    }

    const ownerMetrics: OwnerMetrics = {
      ownerCount: knownOwners.length,
      hasPhone: knownOwners.some((o) => !!o.phone),
      hasEmail: knownOwners.some((o) => !!o.email),
      hasSocial: knownOwners.some(
        (o) => !!o.facebook || !!o.linkedin || (o.otherUrls && o.otherUrls.length > 0)
      ),
      entityType,
    };

    // -- Motivation Metrics --
    const flags = extractMotivationFlags(priorResults);
    const motivationScore =
      (summaryData.motivationScore as number) ??
      (flags.length > 0 ? Math.min(1, flags.length * 0.15 + 0.1) : null);

    const motivationMetrics: MotivationMetrics = {
      flagCount: flags.length,
      flags,
      motivationScore:
        motivationScore !== null
          ? Math.round(motivationScore * 100) / 100
          : null,
    };

    // -- Data Quality --
    const allResults = Object.values(priorResults);
    const succeeded = allResults.filter((r) => r.success);
    const confidences = succeeded.map((r) => r.confidence);
    const avgConfidence =
      confidences.length > 0
        ? confidences.reduce((a, b) => a + b, 0) / confidences.length
        : 0;
    const sourcesCount = allResults.reduce(
      (sum, r) => sum + r.sources.length,
      0
    );

    const dataQuality: DataQuality = {
      pluginsRan: allResults.length,
      pluginsSucceeded: succeeded.length,
      pluginsFailed: allResults.length - succeeded.length,
      averageConfidence: Math.round(avgConfidence * 1000) / 1000,
      sourcesCount,
    };

    // -- Financial Metrics --
    const financialMetrics: FinancialMetrics = {
      mortgageBalance: (financialData.mortgageEstimate as number) ?? null,
      equity: (financialData.estimatedEquity as number) ?? null,
      taxAmount: (assessorData.taxAmount as number) ?? null,
      unclaimedFundsTotal: (unclaimedData.totalAmount as number) ?? null,
    };

    // -- Neighborhood Metrics --
    const neighborhoodMetrics: NeighborhoodMetrics = {
      walkScore: (neighborhoodData.walkScore as number) ?? null,
      crimeIndex: (neighborhoodData.crimeIndex as number) ?? null,
      schoolRating: (neighborhoodData.schoolRating as number) ?? null,
    };

    // -- Market Metrics --
    const computedMetrics =
      (marketData.computedMetrics as Record<string, unknown>) || {};
    const marketMetrics: MarketMetrics = {
      medianPricePerSqft:
        (marketData.pricePerSqft as number) ??
        (computedMetrics.pricePerSqft as number) ??
        null,
      marketTrend: (computedMetrics.marketTrend as string) ?? null,
      absorptionRate: (computedMetrics.absorptionRate as number) ?? null,
    };

    // -- Cross Verification --
    const crossVerification: CrossVerification = {
      overallConfidence:
        (crossVerifyData.overallConfidence as number) ?? null,
    };

    const analyticsPayload: AnalyticsPayload = {
      propertyMetrics,
      ownerMetrics,
      motivationMetrics,
      dataQuality,
      financialMetrics,
      neighborhoodMetrics,
      marketMetrics,
      crossVerification,
      timestamp: new Date().toISOString(),
    };

    const populated = countPopulatedMetrics(analyticsPayload);
    const maxMetrics = 30;
    const confidence = Math.min(
      0.95,
      Math.round((populated / maxMetrics) * 100) / 100
    );

    if (populated < 5) {
      warnings.push(
        `Only ${populated} metrics populated — limited data from prior plugins`
      );
    }

    return {
      pluginName: "analytics-export",
      success: true,
      data: { analyticsPayload },
      sources: [] as SourceLink[],
      confidence,
      warnings,
      durationMs: Date.now() - start,
    };
  },
};
