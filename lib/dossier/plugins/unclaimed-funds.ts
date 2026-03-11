/**
 * Unclaimed Funds Plugin — discovers unclaimed property for listing owners.
 *
 * Priority: 62 (runs after financial at 60, before permits at 65)
 * Depends on: county-assessor (needs owner names)
 *
 * Calls the research worker /unclaimed-funds endpoint with known owners,
 * creates UnclaimedFundScan + UnclaimedFund records, and writes summary
 * to pluginData for the dossier view.
 */

import type {
  DossierPlugin,
  DossierContext,
  DossierPluginResult,
  SourceLink,
} from "../types";

const RESEARCH_WORKER_URL =
  process.env.RESEARCH_WORKER_URL || "http://localhost:8900";
const SYNC_SECRET = process.env.SYNC_SECRET || "";

export const unclaimedFundsPlugin: DossierPlugin = {
  name: "unclaimed-funds",
  label: "Unclaimed Funds",
  description:
    "Searches state unclaimed property databases for funds owed to property owners",
  category: "financial",
  enabled: true,
  priority: 62,
  estimatedDuration: "30-90 sec",
  requiredConfig: ["SYNC_SECRET"], // needs auth to call research worker
  dependsOn: ["county-assessor"],

  async run(context: DossierContext): Promise<DossierPluginResult> {
    const start = Date.now();
    const { listing, priorResults, knownOwners, jobId } = context;
    const sources: SourceLink[] = [];
    const warnings: string[] = [];

    if (knownOwners.length === 0) {
      return {
        pluginName: "unclaimed-funds",
        success: true,
        data: { skipped: true, reason: "No known owners to search" },
        sources,
        confidence: 0,
        warnings: ["No owner names available — skipping unclaimed funds search"],
        durationMs: Date.now() - start,
      };
    }

    await context.updateProgress(
      `Searching unclaimed funds for ${knownOwners.length} owner(s)...`
    );

    // Determine state for source selection
    const state = (listing.state || "MO").toUpperCase();
    const sourcesToSearch: string[] = [];
    if (state === "MO" || !listing.state) {
      sourcesToSearch.push("mo_unclaimed", "mo_tax_surplus");
    }
    if (state === "KS") {
      sourcesToSearch.push("ks_unclaimed");
    }
    // Always search MO + KS for KC metro (dual-state metro)
    if (state === "MO") sourcesToSearch.push("ks_unclaimed");
    if (state === "KS") sourcesToSearch.push("mo_unclaimed");
    // Deduplicate
    const uniqueSources = [...new Set(sourcesToSearch)];

    const primaryOwner = knownOwners[0];
    const alternateNames = knownOwners
      .slice(1)
      .map((o) => o.name)
      .filter(Boolean);

    try {
      const response = await fetch(`${RESEARCH_WORKER_URL}/unclaimed-funds`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-sync-secret": SYNC_SECRET,
        },
        body: JSON.stringify({
          scanId: `dossier-${jobId}`,
          ownerName: primaryOwner.name,
          alternateNames,
          sources: uniqueSources,
        }),
        signal: AbortSignal.timeout(120000), // 2 min timeout
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => "");
        warnings.push(`Research worker returned ${response.status}: ${errText}`);
        return {
          pluginName: "unclaimed-funds",
          success: false,
          error: `Research worker error: ${response.status}`,
          data: {},
          sources,
          confidence: 0,
          warnings,
          durationMs: Date.now() - start,
        };
      }

      const result = await response.json();
      const funds = result.funds || [];
      const totalAmount = funds.reduce(
        (sum: number, f: { amount?: number }) => sum + (f.amount || 0),
        0
      );

      // Add sources from scraper results
      for (const src of result.sources || []) {
        sources.push({
          label: src.label,
          url: src.url,
          type: "government",
        });
      }

      // Build summary data
      const data: Record<string, unknown> = {
        totalFound: funds.length,
        totalAmount,
        funds: funds.map(
          (f: {
            ownerName: string;
            amount?: number;
            source: string;
            holderName?: string;
            propertyType?: string;
            matchConfidence: number;
          }) => ({
            ownerName: f.ownerName,
            amount: f.amount,
            source: f.source,
            holderName: f.holderName,
            propertyType: f.propertyType,
            matchConfidence: f.matchConfidence,
          })
        ),
        searchedOwners: [primaryOwner.name, ...alternateNames],
        sources: uniqueSources,
        scanStatus: result.status,
      };

      if (funds.length === 0) {
        warnings.push("No unclaimed funds found for known owners");
      }

      if (result.errors?.length) {
        for (const err of result.errors) {
          warnings.push(`${err.scraper}: ${err.error}`);
        }
      }

      return {
        pluginName: "unclaimed-funds",
        success: true,
        data,
        sources,
        confidence: funds.length > 0 ? 0.7 : 0.3,
        warnings,
        durationMs: Date.now() - start,
      };
    } catch (e) {
      const error =
        e instanceof Error ? e.message : String(e);
      return {
        pluginName: "unclaimed-funds",
        success: false,
        error,
        data: {},
        sources,
        confidence: 0,
        warnings: [`Unclaimed funds search failed: ${error}`],
        durationMs: Date.now() - start,
      };
    }
  },
};
