import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { calculateMatchScore } from "@/lib/client-intel/match";

export const runtime = "nodejs";

export async function GET(
  _request: NextRequest,
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

  const listing = await prisma.listing.findUnique({
    where: { id },
    include: { enrichment: true },
  });
  if (!listing) {
    return NextResponse.json({ error: "Listing not found" }, { status: 404 });
  }

  const clients = await prisma.client.findMany({
    where: { subscriberId: sub.id, status: "active" },
    take: 100,
  });

  const matches = clients
    .map((client) => {
      const { score, factors } = calculateMatchScore(
        {
          estimatedMaxHome: client.estimatedMaxHome,
          maxPrice: client.maxPrice,
          minPrice: client.minPrice,
          preferredCities: client.preferredCities,
          preferredZips: client.preferredZips,
          minBeds: client.minBeds,
          maxBeds: client.maxBeds,
          minBaths: client.minBaths,
          minSqft: client.minSqft,
          maxSqft: client.maxSqft,
          preferredPropertyTypes: client.preferredPropertyTypes,
          interests: client.interests,
        },
        listing,
        listing.enrichment
      );
      return {
        clientId: client.id,
        firstName: client.firstName,
        lastName: client.lastName,
        email: client.email,
        phone: client.phone,
        buyerSeller: client.buyerSeller,
        fitScore: client.fitScore,
        discType: client.discType,
        score,
        factors,
      };
    })
    .filter((m) => m.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 20);

  // Upsert matches
  for (const match of matches) {
    await prisma.clientMatch.upsert({
      where: {
        clientId_listingId_direction: {
          clientId: match.clientId,
          listingId: id,
          direction: "listing_to_client",
        },
      },
      create: {
        clientId: match.clientId,
        listingId: id,
        matchScore: match.score,
        matchFactors: match.factors,
        direction: "listing_to_client",
      },
      update: {
        matchScore: match.score,
        matchFactors: match.factors,
        computedAt: new Date(),
      },
    });
  }

  return NextResponse.json({ matches, total: matches.length });
}
