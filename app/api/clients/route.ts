/**
 * GET  /api/clients — List all clients for the current subscriber
 * POST /api/clients — Create a new client
 * PATCH /api/clients — Update a client
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { calculateClientFitScore } from "@/lib/client-fit-score";

export const runtime = "nodejs";

async function getSubscriberId(): Promise<string | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  const sub = await prisma.leadSubscriber.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });
  return sub?.id || null;
}

export async function GET() {
  const subscriberId = await getSubscriberId();
  if (!subscriberId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const clients = await prisma.client.findMany({
    where: { subscriberId },
    include: {
      notes: {
        orderBy: { createdAt: "desc" },
        take: 5,
      },
      triggerEvents: {
        orderBy: { occurredAt: "desc" },
      },
      _count: { select: { notes: true } },
    },
    orderBy: [{ fitScore: "desc" }, { updatedAt: "desc" }],
  });

  return NextResponse.json({ clients });
}

export async function POST(request: NextRequest) {
  const subscriberId = await getSubscriberId();
  if (!subscriberId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const {
    firstName,
    lastName,
    email,
    phone,
    facebookUrl,
    instagramUrl,
    linkedinUrl,
    twitterUrl,
    tiktokUrl,
    buyerSeller,
    preApproved,
    preApprovalAmount,
    minPrice,
    maxPrice,
    minBeds,
    maxBeds,
    minBaths,
    minSqft,
    maxSqft,
    preferredCities,
    preferredZips,
    preferredPropertyTypes,
    moveTimeline,
    currentCity,
    currentState,
    movingFrom,
    birthday,
    household,
    kids,
    pets,
    occupation,
    interests,
    dealbreakers,
    avatarUrl,
    jobTitle,
    employer,
    industry,
    educationLevel,
  } = body;

  if (!firstName || !lastName) {
    return NextResponse.json(
      { error: "firstName and lastName required" },
      { status: 400 }
    );
  }

  // Calculate fit score
  const { score, factors } = calculateClientFitScore({
    firstName,
    lastName,
    email,
    phone,
    facebookUrl,
    instagramUrl,
    linkedinUrl,
    buyerSeller: buyerSeller || "buyer",
    preApproved: preApproved || false,
    preApprovalAmount,
    minPrice,
    maxPrice,
    minBeds,
    maxBeds,
    minBaths,
    minSqft,
    maxSqft,
    preferredCities: preferredCities || [],
    preferredZips: preferredZips || [],
    preferredPropertyTypes: preferredPropertyTypes || [],
    moveTimeline,
    currentCity,
    movingFrom,
    birthday,
    household,
    kids,
    pets,
    occupation,
    interests: interests || [],
    dealbreakers: dealbreakers || [],
    noteCount: 0,
    estimatedIncome: null,
    incomeConfidence: null,
    readinessScore: null,
    discType: null,
  });

  const client = await prisma.client.create({
    data: {
      subscriberId,
      firstName,
      lastName,
      email: email || null,
      phone: phone || null,
      facebookUrl: facebookUrl || null,
      instagramUrl: instagramUrl || null,
      linkedinUrl: linkedinUrl || null,
      twitterUrl: twitterUrl || null,
      tiktokUrl: tiktokUrl || null,
      buyerSeller: buyerSeller || "buyer",
      preApproved: preApproved || false,
      preApprovalAmount: preApprovalAmount ? Number(preApprovalAmount) : null,
      minPrice: minPrice ? Number(minPrice) : null,
      maxPrice: maxPrice ? Number(maxPrice) : null,
      minBeds: minBeds ? Number(minBeds) : null,
      maxBeds: maxBeds ? Number(maxBeds) : null,
      minBaths: minBaths ? Number(minBaths) : null,
      minSqft: minSqft ? Number(minSqft) : null,
      maxSqft: maxSqft ? Number(maxSqft) : null,
      preferredCities: preferredCities || [],
      preferredZips: preferredZips || [],
      preferredPropertyTypes: preferredPropertyTypes || [],
      moveTimeline: moveTimeline || null,
      currentCity: currentCity || null,
      currentState: currentState || null,
      movingFrom: movingFrom || null,
      birthday: birthday || null,
      household: household || null,
      kids: kids != null ? Number(kids) : null,
      pets: pets || null,
      occupation: occupation || null,
      interests: interests || [],
      dealbreakers: dealbreakers || [],
      avatarUrl: avatarUrl || null,
      jobTitle: jobTitle || null,
      employer: employer || null,
      industry: industry || null,
      educationLevel: educationLevel || null,
      fitScore: score,
      fitScoreFactors: factors,
    },
    include: { _count: { select: { notes: true } } },
  });

  return NextResponse.json({ client }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const subscriberId = await getSubscriberId();
  if (!subscriberId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { id, ...updates } = body;

  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  // Verify ownership
  const existing = await prisma.client.findFirst({
    where: { id, subscriberId },
    include: { _count: { select: { notes: true } } },
  });
  if (!existing) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  // Build safe update data
  const allowed = [
    "firstName", "lastName", "email", "phone",
    "facebookUrl", "instagramUrl", "linkedinUrl", "twitterUrl", "tiktokUrl",
    "buyerSeller", "preApproved", "preApprovalAmount",
    "minPrice", "maxPrice", "minBeds", "maxBeds", "minBaths", "minSqft", "maxSqft",
    "preferredCities", "preferredZips", "preferredPropertyTypes",
    "moveTimeline", "currentCity", "currentState", "movingFrom",
    "birthday", "household", "kids", "pets", "occupation",
    "interests", "dealbreakers", "status", "avatarUrl",
    "jobTitle", "employer", "industry", "educationLevel",
  ];

  const data: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in updates) {
      if (["preApprovalAmount", "minPrice", "maxPrice"].includes(key)) {
        data[key] = updates[key] != null ? Number(updates[key]) : null;
      } else if (["minBeds", "maxBeds", "kids", "minSqft", "maxSqft"].includes(key)) {
        data[key] = updates[key] != null ? Number(updates[key]) : null;
      } else if (key === "minBaths") {
        data[key] = updates[key] != null ? Number(updates[key]) : null;
      } else if (key === "preApproved") {
        data[key] = Boolean(updates[key]);
      } else {
        data[key] = updates[key];
      }
    }
  }

  // Recalculate fit score with merged data
  const merged = { ...existing, ...data };
  const { score, factors } = calculateClientFitScore({
    firstName: (merged.firstName as string) || existing.firstName,
    lastName: (merged.lastName as string) || existing.lastName,
    email: merged.email as string | null,
    phone: merged.phone as string | null,
    facebookUrl: merged.facebookUrl as string | null,
    instagramUrl: merged.instagramUrl as string | null,
    linkedinUrl: merged.linkedinUrl as string | null,
    buyerSeller: (merged.buyerSeller as string) || "buyer",
    preApproved: Boolean(merged.preApproved),
    preApprovalAmount: merged.preApprovalAmount as number | null,
    minPrice: merged.minPrice as number | null,
    maxPrice: merged.maxPrice as number | null,
    minBeds: merged.minBeds as number | null,
    maxBeds: merged.maxBeds as number | null,
    minBaths: merged.minBaths as number | null,
    minSqft: merged.minSqft as number | null,
    maxSqft: merged.maxSqft as number | null,
    preferredCities: (merged.preferredCities as string[]) || [],
    preferredZips: (merged.preferredZips as string[]) || [],
    preferredPropertyTypes: (merged.preferredPropertyTypes as string[]) || [],
    moveTimeline: merged.moveTimeline as string | null,
    currentCity: merged.currentCity as string | null,
    movingFrom: merged.movingFrom as string | null,
    birthday: merged.birthday as string | null,
    household: merged.household as string | null,
    kids: merged.kids as number | null,
    pets: merged.pets as string | null,
    occupation: merged.occupation as string | null,
    interests: (merged.interests as string[]) || [],
    dealbreakers: (merged.dealbreakers as string[]) || [],
    noteCount: existing._count.notes,
    estimatedIncome: existing.estimatedIncome,
    incomeConfidence: existing.incomeConfidence,
    readinessScore: existing.readinessScore,
    discType: existing.discType,
  });

  data.fitScore = score;
  data.fitScoreFactors = factors;

  const client = await prisma.client.update({
    where: { id },
    data,
    include: {
      notes: { orderBy: { createdAt: "desc" }, take: 5 },
      _count: { select: { notes: true } },
    },
  });

  return NextResponse.json({ client });
}
