import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { DISC_QUESTIONS, scoreDISC, getDISCPlaybook } from "@/lib/client-intel/disc";
import { calculateClientFitScore } from "@/lib/client-fit-score";
import { DISC_DISCLAIMER } from "@/lib/client-intel/compliance";

export const runtime = "nodejs";

async function getClientWithAuth(clientId: string) {
  const session = await auth();
  if (!session?.user?.id) return null;
  const sub = await prisma.leadSubscriber.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (!sub) return null;
  return prisma.client.findFirst({
    where: { id: clientId, subscriberId: sub.id },
    include: { _count: { select: { notes: true } } },
  });
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const client = await getClientWithAuth(id);
  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  if (client.discType) {
    const playbook = getDISCPlaybook(client.discType);
    return NextResponse.json({
      assessed: true,
      type: client.discType,
      secondary: client.discSecondary,
      assessment: client.discAssessment,
      playbook,
      disclaimer: DISC_DISCLAIMER,
    });
  }

  return NextResponse.json({
    assessed: false,
    questions: DISC_QUESTIONS,
    disclaimer: DISC_DISCLAIMER,
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const client = await getClientWithAuth(id);
  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  const body = await request.json();
  const { answers } = body;

  if (!Array.isArray(answers) || answers.length !== DISC_QUESTIONS.length) {
    return NextResponse.json(
      { error: `Exactly ${DISC_QUESTIONS.length} answers required` },
      { status: 400 }
    );
  }

  const result = scoreDISC(answers);
  const playbook = getDISCPlaybook(result.primary);

  await prisma.client.update({
    where: { id },
    data: {
      discType: result.primary,
      discSecondary: result.secondary,
      discAssessment: { answers, scores: result.scores },
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
    estimatedIncome: client.estimatedIncome,
    incomeConfidence: client.incomeConfidence,
    readinessScore: client.readinessScore,
    discType: result.primary,
  });

  await prisma.client.update({
    where: { id },
    data: { fitScore: score, fitScoreFactors: factors },
  });

  return NextResponse.json({
    type: result.primary,
    secondary: result.secondary,
    scores: result.scores,
    playbook,
    fitScore: score,
    disclaimer: DISC_DISCLAIMER,
  });
}
