import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export const runtime = "nodejs";

async function checkAuth(request: NextRequest): Promise<boolean> {
  const syncSecret = process.env.SYNC_SECRET;
  const authHeader = request.headers.get("x-sync-secret");
  if (syncSecret && authHeader === syncSecret) return true;
  const session = await auth();
  return Boolean(session?.user?.id);
}

/**
 * GET /api/leads
 *
 * List leads with filtering and sorting.
 * Query params:
 *   ?status=new,contacted   — filter by status (comma-separated)
 *   ?minScore=25            — minimum lead score
 *   ?source=mls_expired     — filter by source
 *   ?limit=20               — max results (default 50)
 *   ?offset=0               — pagination offset
 */
export async function GET(request: NextRequest) {
  if (!(await checkAuth(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = request.nextUrl.searchParams;
  const statusFilter = params.get("status")?.split(",") || undefined;
  const minScore = Number(params.get("minScore")) || 0;
  const source = params.get("source") || undefined;
  const limit = Math.min(Number(params.get("limit")) || 50, 200);
  const offset = Number(params.get("offset")) || 0;

  const where: Record<string, unknown> = {};
  if (statusFilter) where.status = { in: statusFilter };
  if (minScore > 0) where.score = { gte: minScore };
  if (source) where.source = source;

  const [leads, total] = await Promise.all([
    prisma.lead.findMany({
      where,
      include: {
        listing: {
          select: {
            id: true,
            mlsId: true,
            address: true,
            city: true,
            zip: true,
            listPrice: true,
            originalListPrice: true,
            daysOnMarket: true,
            beds: true,
            baths: true,
            sqft: true,
            status: true,
            listingUrl: true,
            photoUrls: true,
            listAgentName: true,
            listOfficeName: true,
            enrichment: {
              select: {
                buyScore: true,
                nearestSchoolName: true,
                nearestSchoolDist: true,
                schoolsWithin3mi: true,
                nearestHospitalName: true,
                nearestHospitalDist: true,
                nearestFireStationDist: true,
                nearestParkName: true,
                nearestParkDist: true,
                parksWithin2mi: true,
                nearestGroceryName: true,
                nearestGroceryDist: true,
                nearestAirportName: true,
                nearestAirportDist: true,
                restaurantsWithin1mi: true,
                nearestCourthouseName: true,
                nearestCourthouseDist: true,
                nearestLibraryName: true,
                nearestLibraryDist: true,
                librariesWithin3mi: true,
                countyName: true,
                countyState: true,
                estimatedAnnualTax: true,
                estimatedMonthlyTax: true,
                effectiveTaxRate: true,
                taxBurdenRating: true,
              },
            },
          },
        },
      },
      orderBy: [{ score: "desc" }, { createdAt: "desc" }],
      take: limit,
      skip: offset,
    }),
    prisma.lead.count({ where }),
  ]);

  return NextResponse.json({ leads, total, limit, offset });
}

/**
 * PATCH /api/leads
 *
 * Update a lead's status, notes, referral info.
 * Body: { id, status?, notes?, referredTo?, referralStatus?, referralFee?, contactedAt? }
 */
export async function PATCH(request: NextRequest) {
  if (!(await checkAuth(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { id, ...updates } = body;

  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  // Only allow safe fields
  const allowed = [
    "status",
    "notes",
    "referredTo",
    "referralStatus",
    "referralFee",
    "contactedAt",
    "closedAt",
    "ownerName",
    "ownerPhone",
    "ownerEmail",
  ];

  const data: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in updates) {
      if (key === "contactedAt" || key === "closedAt") {
        data[key] = updates[key] ? new Date(updates[key]) : null;
      } else {
        data[key] = updates[key];
      }
    }
  }

  const lead = await prisma.lead.update({
    where: { id },
    data,
    include: { listing: { select: { address: true, mlsId: true } } },
  });

  return NextResponse.json({ lead });
}
