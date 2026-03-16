import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const platform = searchParams.get("platform");
  const status = searchParams.get("status");
  const limit = parseInt(searchParams.get("limit") || "100", 10);

  const where: Record<string, unknown> = {};
  if (platform) where.platform = platform;
  if (status && status !== "all") where.status = status;

  const listings = await prisma.platformListing.findMany({
    where,
    include: {
      product: {
        select: {
          id: true,
          title: true,
          imageUrls: true,
          category: true,
          totalCogs: true,
          status: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return NextResponse.json(listings);
}
