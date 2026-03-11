import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { estimateIncome } from "@/lib/client-intel/income";
import { calculateAffordability } from "@/lib/client-intel/affordability";
import { calculateClientFitScore } from "@/lib/client-fit-score";
import { INCOME_DISCLAIMER, AFFORDABILITY_DISCLAIMER } from "@/lib/client-intel/compliance";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const sub = await prisma.leadSubscriber.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (!sub) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const client = await prisma.client.findFirst({
    where: { id, subscriberId: sub.id },
    include: { _count: { select: { notes: true } } },
  });
  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  const jobTitle = client.jobTitle || client.occupation;
  if (!jobTitle) {
    return NextResponse.json(
      { error: "Job title or occupation required for income estimation" },
      { status: 400 }
    );
  }

  const location =
    client.currentCity && client.currentState
      ? `${client.currentCity}, ${client.currentState}`
      : client.currentCity || client.currentState || "United States";

  const zip = client.preferredZips[0] || null;

  const income = await estimateIncome(jobTitle, location, zip);
  const affordability = calculateAffordability(income.estimated);

  const updated = await prisma.client.update({
    where: { id },
    data: {
      estimatedIncome: income.estimated,
      incomeRangeLow: income.rangeLow,
      incomeRangeHigh: income.rangeHigh,
      incomeSource: income.source,
      incomeConfidence: income.confidence,
      incomeEstimatedAt: new Date(),
      estimatedMaxHome: affordability.maxHomePrice,
      affordabilityData: {
        maxMonthly: affordability.maxMonthlyHousing,
        ...affordability.assumptions,
        details: income.details,
      },
    },
  });

  // Recalculate fit score
  const { score, factors } = calculateClientFitScore({
    firstName: client.firstName,
    lastName: client.lastName,
    email: client.email,
    phone: client.phone,
    facebookUrl: client.facebookUrl,
    instagramUrl: client.instagramUrl,
    linkedinUrl: client.linkedinUrl,
    buyerSeller: client.buyerSeller,
    preApproved: client.preApproved,
    preApprovalAmount: client.preApprovalAmount,
    minPrice: client.minPrice,
    maxPrice: client.maxPrice,
    minBeds: client.minBeds,
    maxBeds: client.maxBeds,
    minBaths: client.minBaths,
    minSqft: client.minSqft,
    maxSqft: client.maxSqft,
    preferredCities: client.preferredCities,
    preferredZips: client.preferredZips,
    preferredPropertyTypes: client.preferredPropertyTypes,
    moveTimeline: client.moveTimeline,
    currentCity: client.currentCity,
    movingFrom: client.movingFrom,
    birthday: client.birthday,
    household: client.household,
    kids: client.kids,
    pets: client.pets,
    occupation: client.occupation,
    interests: client.interests,
    dealbreakers: client.dealbreakers,
    noteCount: client._count.notes,
    estimatedIncome: income.estimated,
    incomeConfidence: income.confidence,
    readinessScore: client.readinessScore,
    discType: client.discType,
  });

  await prisma.client.update({
    where: { id },
    data: { fitScore: score, fitScoreFactors: factors },
  });

  return NextResponse.json({
    income: {
      estimated: income.estimated,
      rangeLow: income.rangeLow,
      rangeHigh: income.rangeHigh,
      source: income.source,
      confidence: income.confidence,
      details: income.details,
    },
    affordability: {
      maxMonthlyHousing: affordability.maxMonthlyHousing,
      maxHomePrice: affordability.maxHomePrice,
      assumptions: affordability.assumptions,
    },
    fitScore: score,
    disclaimers: {
      income: INCOME_DISCLAIMER,
      affordability: AFFORDABILITY_DISCLAIMER,
    },
    client: { ...updated, fitScore: score, fitScoreFactors: factors },
  });
}
