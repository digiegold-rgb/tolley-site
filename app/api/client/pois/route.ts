import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * GET /api/client/pois?type=restaurant&limit=20
 * GET /api/client/pois/stats — counts by type
 */
export async function GET(request: NextRequest) {
  const type = request.nextUrl.searchParams.get("type");
  const limit = Math.min(parseInt(request.nextUrl.searchParams.get("limit") || "50"), 200);
  const stats = request.nextUrl.searchParams.get("stats");

  if (stats === "true") {
    const counts = await prisma.pointOfInterest.groupBy({
      by: ["type"],
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
    });
    return NextResponse.json({
      stats: counts.map((c) => ({ type: c.type, count: c._count.id })),
    });
  }

  if (!type) {
    return NextResponse.json(
      { error: "type param required (restaurant, school, park, etc.)" },
      { status: 400 }
    );
  }

  const pois = await prisma.pointOfInterest.findMany({
    where: { type, name: { not: null } },
    select: { id: true, name: true, type: true, lat: true, lng: true, tags: true },
    take: limit,
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ pois, total: pois.length });
}
