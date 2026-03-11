/**
 * NARRPR Import Plugin — checks for pre-staged NARRPR data during pipeline run.
 *
 * Priority: 8 — runs before county-assessor (10)
 * dependsOn: [] — reads from NarrprImport staging table
 *
 * When dossier pipeline runs, checks if NARRPR data was pre-staged for this address.
 * Returns staged data as plugin result so downstream plugins (financial, etc.) use it.
 */

import type {
  DossierPlugin,
  DossierContext,
  DossierPluginResult,
  SourceLink,
} from "../types";
import { prisma } from "@/lib/prisma";

export const narrprImportPlugin: DossierPlugin = {
  name: "narrpr-import",
  label: "NARRPR Data",
  description: "Checks for pre-staged NARRPR data (mortgage, RVM, demographics, distress, deeds)",
  category: "financial",
  enabled: true,
  priority: 8,
  estimatedDuration: "< 1 sec",
  requiredConfig: [], // Reads from DB, no external API
  dependsOn: [],

  async run(context: DossierContext): Promise<DossierPluginResult> {
    const start = Date.now();
    const { listing } = context;
    const sources: SourceLink[] = [];
    const warnings: string[] = [];

    await context.updateProgress("Checking for NARRPR data...");

    // Look for staged NARRPR imports matching this listing
    const imports = await prisma.narrprImport.findMany({
      where: {
        OR: [
          { matchedListingId: listing.id },
          {
            address: { contains: listing.address.split(" ").slice(0, 3).join(" "), mode: "insensitive" },
            status: { in: ["staged", "matched"] },
          },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    });

    if (imports.length === 0) {
      return {
        pluginName: "narrpr-import",
        success: true,
        data: { hasNarrprData: false },
        sources: [],
        confidence: 0,
        warnings: ["No NARRPR data staged for this property"],
        durationMs: Date.now() - start,
      };
    }

    // Aggregate data from all matching imports (rich detail has the most data)
    const richImports = imports.filter((i) => i.importType === "rich_detail");
    const csvImports = imports.filter((i) => i.importType === "csv_bulk");

    // Extract data from the most recent rich import
    const richData = richImports[0];
    const csvData = csvImports[0];

    const result: Record<string, unknown> = {
      hasNarrprData: true,
      importCount: imports.length,
    };

    // Owner data from CSV
    if (csvData?.ownerName) {
      const owners = [
        { name: csvData.ownerName, role: "owner", confidence: 0.9 },
      ];
      if (csvData.ownerName2) {
        owners.push({ name: csvData.ownerName2, role: "co-owner", confidence: 0.9 });
      }
      result.owners = owners;
    }

    // Rich data fields
    if (richData?.mortgageData) {
      result.narrprMortgages = richData.mortgageData;
      const mortgages = richData.mortgageData as { amount: number; date: string; lender: string; type: string; rate?: number }[];
      if (mortgages.length > 0) {
        const most = mortgages.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
        result.narrprMortgage = most;
      }
    }

    if (richData?.rvmValue) {
      result.narrprRvm = richData.rvmValue;
    }

    if (richData?.esriTapestry) {
      result.esriTapestry = richData.esriTapestry;
      result.demographics = {
        esriTapestry: richData.esriTapestry,
        source: "NARRPR / Esri",
      };
    }

    if (richData?.distressData) {
      result.narrprDistress = richData.distressData;
      const distress = richData.distressData as { nodDate?: string; auctionDate?: string };
      if (distress.nodDate) {
        result.preForeclosure = true;
      }
    }

    if (richData?.deedRecords) {
      result.deedHistory = richData.deedRecords;
    }

    sources.push({
      label: "NARRPR Import Data",
      url: "https://narrpr.com",
      type: "commercial",
    });

    // Mark imports as consumed by pipeline
    for (const imp of imports) {
      if (imp.status !== "merged") {
        await prisma.narrprImport.update({
          where: { id: imp.id },
          data: {
            matchedListingId: listing.id,
            status: "merged",
            mergedAt: new Date(),
          },
        });
      }
    }

    return {
      pluginName: "narrpr-import",
      success: true,
      data: result,
      sources,
      confidence: 0.9,
      warnings,
      durationMs: Date.now() - start,
    };
  },
};
