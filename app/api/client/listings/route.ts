import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const KC_ZIPS = [
  "64050", "64052", "64054", "64055", "64056", "64057", "64058",
  "64014", "64015", "64029", "64064", "64081", "64082", "64083",
  "64086", "64063", "64030", "64034", "64068", "64079",
  "64106", "64108", "64109", "64110", "64111", "64112", "64113",
  "64114", "64116", "64117", "64118", "64119", "64120",
  "64124", "64125", "64126", "64127", "64128", "64129", "64130",
  "64131", "64132", "64133", "64134", "64136", "64137", "64138",
  "64139", "64145", "64146", "64147", "64149", "64151", "64152",
  "64153", "64154", "64155", "64156", "64157", "64158", "64161",
  "64163", "64164", "64165", "64166", "64167",
  "66202", "66204", "66210", "66211", "66212", "66213", "66214",
  "66215", "66219", "66220", "66221", "66223", "66224",
  "66061", "66062", "66063",
];

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const beds = parseInt(searchParams.get("beds") || "0");
  const minPrice = parseInt(searchParams.get("minPrice") || "0");
  const maxPrice = parseInt(searchParams.get("maxPrice") || "0");
  const type = searchParams.get("type");
  const limit = Math.min(parseInt(searchParams.get("limit") || "24"), 48);

  const where: Record<string, unknown> = {
    status: "Active",
    zip: { in: KC_ZIPS },
  };

  if (beds > 0) where.beds = { gte: beds };
  if (minPrice > 0) where.listPrice = { ...(where.listPrice as object || {}), gte: minPrice };
  if (maxPrice > 0) where.listPrice = { ...(where.listPrice as object || {}), lte: maxPrice };
  if (type) where.propertyType = type;

  try {
    const listings = await prisma.listing.findMany({
      where,
      select: {
        id: true,
        mlsId: true,
        address: true,
        city: true,
        state: true,
        zip: true,
        listPrice: true,
        beds: true,
        baths: true,
        sqft: true,
        daysOnMarket: true,
        photoUrls: true,
        propertyType: true,
        enrichment: {
          select: { buyScore: true },
        },
      },
      orderBy: [{ daysOnMarket: "asc" }],
      take: limit,
    });

    const serialized = listings.map((l) => ({
      id: l.id,
      mlsId: l.mlsId,
      address: l.address,
      city: l.city,
      state: l.state,
      zip: l.zip,
      listPrice: l.listPrice,
      beds: l.beds,
      baths: l.baths,
      sqft: l.sqft,
      daysOnMarket: l.daysOnMarket,
      photoUrl: l.photoUrls?.[0] || null,
      propertyType: l.propertyType,
      buyScore: l.enrichment?.buyScore ?? 0,
    }));

    return NextResponse.json({ listings: serialized });
  } catch (e) {
    console.error("[client/listings] Error:", e);
    return NextResponse.json({ listings: [] });
  }
}
