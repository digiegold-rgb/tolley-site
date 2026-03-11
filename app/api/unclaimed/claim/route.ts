/**
 * POST /api/unclaimed/claim — Start a claim on a discovered fund
 */

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { computeCompliance } from "@/lib/unclaimed/compliance";
import type { Jurisdiction, SourceType } from "@/lib/unclaimed/compliance";

const SOURCE_MAP: Record<string, { jurisdiction: Jurisdiction; sourceType: SourceType }> = {
  mo_unclaimed: { jurisdiction: "MO", sourceType: "state_unclaimed" },
  mo_tax_surplus: { jurisdiction: "MO", sourceType: "tax_surplus" },
  ks_unclaimed: { jurisdiction: "KS", sourceType: "state_unclaimed" },
  pa_unclaimed: { jurisdiction: "PA", sourceType: "state_unclaimed" },
  hud: { jurisdiction: "MO", sourceType: "hud" },
  fdic: { jurisdiction: "MO", sourceType: "fdic" },
};

export async function POST(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "LOGIN_REQUIRED" }, { status: 401 });
  }

  const body = await req.json();
  const { fundId } = body;

  if (!fundId) {
    return NextResponse.json({ error: "fundId is required" }, { status: 400 });
  }

  // Get subscriber
  const sub = await prisma.leadSubscriber.findUnique({ where: { userId } });
  if (!sub) {
    return NextResponse.json({ error: "No subscription" }, { status: 403 });
  }

  // Get the fund
  const fund = await prisma.unclaimedFund.findUnique({
    where: { id: fundId },
    include: { scan: true, claim: true },
  });

  if (!fund) {
    return NextResponse.json({ error: "Fund not found" }, { status: 404 });
  }

  if (fund.scan.userId !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (fund.claim) {
    return NextResponse.json(
      { error: "Claim already exists", claimId: fund.claim.id },
      { status: 409 }
    );
  }

  // Compute compliance
  const mapping = SOURCE_MAP[fund.source] || {
    jurisdiction: "MO" as Jurisdiction,
    sourceType: "state_unclaimed" as SourceType,
  };

  const compliance = computeCompliance({
    ...mapping,
    reportDate: fund.reportDate,
    saleDate: fund.reportDate, // for tax surplus
    amount: fund.amount,
  });

  // Create claim
  const claim = await prisma.unclaimedFundClaim.create({
    data: {
      fundId,
      subscriberId: sub.id,
      status: "identified",
      jurisdiction: mapping.jurisdiction,
      sourceType: mapping.sourceType,
      waitingPeriodEnd: compliance.waitingPeriodEnd,
      maxFeePercent: compliance.maxFeePercent,
      currentFeeWindow: compliance.currentFeeWindow,
      claimDeadline: compliance.claimDeadline,
      statuteReference: compliance.statuteReference,
      complianceWarnings: compliance.warnings,
      claimAmount: fund.amount,
    },
  });

  return NextResponse.json({
    ok: true,
    claim,
    compliance: {
      isClaimable: compliance.isClaimable,
      currentFeeWindow: compliance.currentFeeWindow,
      maxFeePercent: compliance.maxFeePercent,
      waitingPeriodEnd: compliance.waitingPeriodEnd,
      claimDeadline: compliance.claimDeadline,
      statuteReference: compliance.statuteReference,
      warnings: compliance.warnings,
    },
  });
}
