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

  const client = await prisma.client.findFirst({
    where: { id, subscriberId: sub.id },
  });
  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  // Get active listings (limit to reasonable scope)
  const where: Record<string, unknown> = { status: "Active" };
  if (client.preferredZips.length > 0) {
    where.zip = { in: client.preferredZips };
  } else if (client.preferredCities.length > 0) {
    where.city = { in: client.preferredCities, mode: "insensitive" };
  }

  const listings = await prisma.listing.findMany({
    where,
    include: { enrichment: true },
    take: 200,
  });

  const matches = listings
    .map((listing) => {
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
        listingId: listing.id,
        mlsId: listing.mlsId,
        address: listing.address,
        city: listing.city,
        zip: listing.zip,
        listPrice: listing.listPrice,
        beds: listing.beds,
        baths: listing.baths,
        sqft: listing.sqft,
        propertyType: listing.propertyType,
        score,
        factors,
      };
    })
    .filter((m) => m.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 20);

  // Upsert matches for persistence
  for (const match of matches) {
    await prisma.clientMatch.upsert({
      where: {
        clientId_listingId_direction: {
          clientId: id,
          listingId: match.listingId,
          direction: "client_to_listing",
        },
      },
      create: {
        clientId: id,
        listingId: match.listingId,
        matchScore: match.score,
        matchFactors: match.factors,
        direction: "client_to_listing",
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
