/**
 * NARRPR Merge Logic — merges NARRPR data into existing DossierResult fields.
 */

import { prisma } from "@/lib/prisma";
import type {
  NarrprMortgage,
  NarrprRvm,
  NarrprTapestry,
  NarrprDistress,
  NarrprDeed,
} from "./types";

interface MergeContext {
  dossierResultId: string;
  narrprImportId: string;
}

/**
 * Merge owner names from NARRPR CSV into DossierResult.owners.
 * Adds with confidence 0.9, detects absentee via mailing address comparison.
 */
export async function mergeOwners(
  ctx: MergeContext,
  ownerName: string,
  ownerName2?: string,
  isAbsentee?: boolean
): Promise<void> {
  const result = await prisma.dossierResult.findUnique({
    where: { id: ctx.dossierResultId },
    select: { owners: true, motivationFlags: true },
  });
  if (!result) return;

  const existingOwners = (result.owners || []) as { name: string; role: string; confidence: number }[];
  const newOwners = [...existingOwners];

  // Add primary owner if not already present
  if (ownerName && !existingOwners.some((o) => o.name.toLowerCase() === ownerName.toLowerCase())) {
    newOwners.push({
      name: ownerName,
      role: "owner",
      confidence: 0.9,
    });
  }

  // Add secondary owner if not already present
  if (ownerName2 && !existingOwners.some((o) => o.name.toLowerCase() === ownerName2.toLowerCase())) {
    newOwners.push({
      name: ownerName2,
      role: "co-owner",
      confidence: 0.9,
    });
  }

  const updates: Record<string, unknown> = {
    owners: JSON.parse(JSON.stringify(newOwners)),
  };

  // Add absentee_owner flag if detected
  if (isAbsentee) {
    const flags = [...(result.motivationFlags || [])];
    if (!flags.includes("absentee_owner")) {
      flags.push("absentee_owner");
      updates.motivationFlags = flags;
    }
  }

  await prisma.dossierResult.update({
    where: { id: ctx.dossierResultId },
    data: updates,
  });
}

/**
 * Merge actual NARRPR mortgage data into DossierResult.financialData.
 * Replaces estimated mortgage with actual lender/amount/type/date.
 */
export async function mergeMortgage(
  ctx: MergeContext,
  mortgages: NarrprMortgage[]
): Promise<void> {
  if (!mortgages.length) return;

  const result = await prisma.dossierResult.findUnique({
    where: { id: ctx.dossierResultId },
    select: { financialData: true },
  });
  if (!result) return;

  const financial = (result.financialData || {}) as Record<string, unknown>;

  // Use most recent mortgage as primary
  const sorted = [...mortgages].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
  const primary = sorted[0];

  financial.narrprMortgages = mortgages;
  financial.mortgageActual = {
    lender: primary.lender,
    amount: primary.amount,
    type: primary.type,
    date: primary.date,
    rate: primary.rate,
  };
  financial.mortgageSource = "NARRPR";

  await prisma.dossierResult.update({
    where: { id: ctx.dossierResultId },
    data: { financialData: JSON.parse(JSON.stringify(financial)) },
  });
}

/**
 * Merge NARRPR RVM (Realtors Valuation Model) into financial data.
 * RVM is MLS-informed, higher priority than county but lower than Zestimate.
 */
export async function mergeRvm(
  ctx: MergeContext,
  rvm: NarrprRvm
): Promise<void> {
  const result = await prisma.dossierResult.findUnique({
    where: { id: ctx.dossierResultId },
    select: { financialData: true },
  });
  if (!result) return;

  const financial = (result.financialData || {}) as Record<string, unknown>;
  financial.narrprRvm = rvm;
  financial.rvmSource = "NARRPR RVM";

  await prisma.dossierResult.update({
    where: { id: ctx.dossierResultId },
    data: { financialData: JSON.parse(JSON.stringify(financial)) },
  });
}

/**
 * Merge Esri Tapestry demographics into DossierResult.neighborhoodData.
 */
export async function mergeDemographics(
  ctx: MergeContext,
  tapestry: NarrprTapestry
): Promise<void> {
  const result = await prisma.dossierResult.findUnique({
    where: { id: ctx.dossierResultId },
    select: { neighborhoodData: true },
  });
  if (!result) return;

  const neighborhood = (result.neighborhoodData || {}) as Record<string, unknown>;
  neighborhood.demographics = {
    esriTapestry: tapestry,
    source: "NARRPR / Esri",
  };

  await prisma.dossierResult.update({
    where: { id: ctx.dossierResultId },
    data: { neighborhoodData: JSON.parse(JSON.stringify(neighborhood)) },
  });
}

/**
 * Merge NARRPR distress signals into motivation flags + score.
 */
export async function mergeDistress(
  ctx: MergeContext,
  distress: NarrprDistress
): Promise<void> {
  const result = await prisma.dossierResult.findUnique({
    where: { id: ctx.dossierResultId },
    select: { motivationFlags: true, motivationScore: true, financialData: true },
  });
  if (!result) return;

  const flags = [...(result.motivationFlags || [])];
  let scoreBoost = 0;

  if (distress.nodDate) {
    if (!flags.includes("pre_foreclosure")) {
      flags.push("pre_foreclosure");
      scoreBoost += 25;
    }
  }
  if (distress.auctionDate) {
    scoreBoost += 10; // Additional urgency
  }

  const financial = (result.financialData || {}) as Record<string, unknown>;
  financial.narrprDistress = distress;

  await prisma.dossierResult.update({
    where: { id: ctx.dossierResultId },
    data: {
      motivationFlags: flags,
      motivationScore: Math.min(100, (result.motivationScore || 0) + scoreBoost),
      financialData: JSON.parse(JSON.stringify(financial)),
    },
  });
}

/**
 * Merge NARRPR deed records into DossierResult.deedHistory.
 * Deduplicates by date + grantor.
 */
export async function mergeDeeds(
  ctx: MergeContext,
  deeds: NarrprDeed[]
): Promise<void> {
  if (!deeds.length) return;

  const result = await prisma.dossierResult.findUnique({
    where: { id: ctx.dossierResultId },
    select: { deedHistory: true },
  });
  if (!result) return;

  const existing = (result.deedHistory || []) as { date: string; grantor: string; [key: string]: unknown }[];
  const merged = [...existing];

  for (const deed of deeds) {
    const isDuplicate = existing.some(
      (d) =>
        d.date === deed.date &&
        d.grantor?.toLowerCase() === deed.grantor?.toLowerCase()
    );
    if (!isDuplicate) {
      merged.push({
        date: deed.date,
        price: deed.price,
        grantor: deed.grantor,
        grantee: deed.grantee,
        type: deed.type,
        sourceUrl: "NARRPR",
      });
    }
  }

  // Sort by date descending
  merged.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  await prisma.dossierResult.update({
    where: { id: ctx.dossierResultId },
    data: { deedHistory: JSON.parse(JSON.stringify(merged)) },
  });
}

/**
 * Run all merge operations for rich NARRPR data.
 */
export async function mergeAllRichData(
  ctx: MergeContext,
  data: {
    mortgages?: NarrprMortgage[];
    rvm?: NarrprRvm;
    tapestry?: NarrprTapestry;
    distress?: NarrprDistress;
    deeds?: NarrprDeed[];
  }
): Promise<void> {
  if (data.mortgages?.length) await mergeMortgage(ctx, data.mortgages);
  if (data.rvm) await mergeRvm(ctx, data.rvm);
  if (data.tapestry) await mergeDemographics(ctx, data.tapestry);
  if (data.distress) await mergeDistress(ctx, data.distress);
  if (data.deeds?.length) await mergeDeeds(ctx, data.deeds);

  // Mark import as merged
  await prisma.narrprImport.update({
    where: { id: ctx.narrprImportId },
    data: { status: "merged", mergedAt: new Date() },
  });
}
