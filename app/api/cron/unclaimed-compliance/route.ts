/**
 * POST /api/cron/unclaimed-compliance — Daily compliance window recomputation
 *
 * Runs daily to:
 * 1. Recompute fee windows as time passes (claims may enter new tiers)
 * 2. Alert when claims approach deadlines
 * 3. Reset monthly fundScanUsed (if triggered on 1st)
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { computeCompliance } from "@/lib/unclaimed/compliance";
import type { Jurisdiction, SourceType } from "@/lib/unclaimed/compliance";

export async function POST(req: Request) {
  // Auth: Vercel cron sends Bearer token
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  let updated = 0;
  let deadlineAlerts = 0;
  let windowChanges = 0;

  // Get all active claims (not paid)
  const claims = await prisma.unclaimedFundClaim.findMany({
    where: {
      status: { notIn: ["paid"] },
    },
    include: {
      fund: true,
    },
  });

  for (const claim of claims) {
    const compliance = computeCompliance(
      {
        jurisdiction: claim.jurisdiction as Jurisdiction,
        sourceType: claim.sourceType as SourceType,
        reportDate: claim.fund.reportDate,
        saleDate: claim.fund.reportDate,
        amount: claim.fund.amount,
      },
      now
    );

    const updates: Record<string, unknown> = {};

    // Check if fee window changed
    if (compliance.currentFeeWindow !== claim.currentFeeWindow) {
      updates.currentFeeWindow = compliance.currentFeeWindow;
      updates.maxFeePercent = compliance.maxFeePercent;
      updates.complianceWarnings = compliance.warnings;
      windowChanges++;
    }

    // Update waiting period
    if (
      compliance.waitingPeriodEnd?.toISOString() !==
      claim.waitingPeriodEnd?.toISOString()
    ) {
      updates.waitingPeriodEnd = compliance.waitingPeriodEnd;
    }

    // Check deadline proximity (warn 30 days before)
    if (compliance.claimDeadline) {
      const daysToDeadline = Math.floor(
        (compliance.claimDeadline.getTime() - now.getTime()) /
          (1000 * 60 * 60 * 24)
      );
      if (daysToDeadline <= 30 && daysToDeadline > 0) {
        const warning = `URGENT: Claim deadline in ${daysToDeadline} days (${compliance.claimDeadline.toISOString().split("T")[0]})`;
        if (!claim.complianceWarnings.includes(warning)) {
          updates.complianceWarnings = [
            ...compliance.warnings,
            warning,
          ];
          deadlineAlerts++;
        }
      }
    }

    if (Object.keys(updates).length > 0) {
      await prisma.unclaimedFundClaim.update({
        where: { id: claim.id },
        data: updates,
      });
      updated++;
    }
  }

  // Reset monthly fund scan counters on the 1st
  if (now.getDate() === 1) {
    await prisma.leadSubscriber.updateMany({
      data: { fundScanUsed: 0 },
    });
  }

  console.log(
    `[cron/unclaimed-compliance] Processed ${claims.length} claims: ${updated} updated, ${windowChanges} window changes, ${deadlineAlerts} deadline alerts`
  );

  return NextResponse.json({
    ok: true,
    processed: claims.length,
    updated,
    windowChanges,
    deadlineAlerts,
    resetScans: now.getDate() === 1,
  });
}
