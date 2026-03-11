/**
 * POST /api/regrid/lookup
 * Single parcel lookup by address or lat/lng.
 * Cache-first: checks Parcel table → if miss/stale → calls Regrid → upserts.
 */

import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { lookupByAddress, lookupByPoint, type ParsedParcel } from "@/lib/regrid";

const prisma = new PrismaClient();
const CACHE_TTL_DAYS = 30;

export async function POST(req: NextRequest) {
  // Auth: x-sync-secret or session
  const syncSecret = req.headers.get("x-sync-secret");
  const expectedSecret = process.env.SYNC_SECRET;
  if (!syncSecret || syncSecret !== expectedSecret) {
    // TODO: also accept session auth
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { address, lat, lng } = body as {
    address?: string;
    lat?: number;
    lng?: number;
  };

  if (!address && (lat == null || lng == null)) {
    return NextResponse.json(
      { error: "Provide address or lat+lng" },
      { status: 400 }
    );
  }

  try {
    // Cache check — try to find existing fresh parcel
    if (address) {
      const cached = await prisma.parcel.findFirst({
        where: {
          address: { contains: address.split(",")[0].trim(), mode: "insensitive" },
          regridFetchedAt: {
            gte: new Date(Date.now() - CACHE_TTL_DAYS * 24 * 60 * 60 * 1000),
          },
        },
      });
      if (cached) {
        return NextResponse.json({ parcel: cached, cached: true });
      }
    }

    // Fetch from Regrid
    let parcels: ParsedParcel[];
    if (address) {
      parcels = await lookupByAddress(address);
    } else {
      parcels = await lookupByPoint(lat!, lng!);
    }

    if (parcels.length === 0) {
      return NextResponse.json({ parcel: null, cached: false });
    }

    // Take the best match (first result)
    const parsed = parcels[0];

    // Upsert to database
    const parcel = await prisma.parcel.upsert({
      where: { regridId: parsed.regridId },
      create: {
        regridId: parsed.regridId,
        parcelnumb: parsed.parcelnumb,
        address: parsed.address,
        city: parsed.city,
        state: parsed.state,
        zip: parsed.zip,
        county: parsed.county,
        lat: parsed.lat,
        lng: parsed.lng,
        owner: parsed.owner,
        owntype: parsed.owntype,
        ownfrst: parsed.ownfrst,
        ownlast: parsed.ownlast,
        mailadd: parsed.mailadd,
        mailcity: parsed.mailcity,
        mailstate: parsed.mailstate,
        mailzip: parsed.mailzip,
        isAbsentee: parsed.isAbsentee,
        isVacant: parsed.isVacant,
        parval: parsed.parval,
        landval: parsed.landval,
        improvval: parsed.improvval,
        saleprice: parsed.saleprice,
        saledate: parsed.saledate,
        taxamt: parsed.taxamt,
        yearbuilt: parsed.yearbuilt,
        numstories: parsed.numstories,
        numunits: parsed.numunits,
        num_bedrooms: parsed.num_bedrooms,
        num_bath: parsed.num_bath,
        struct: parsed.struct,
        ll_gisacre: parsed.ll_gisacre,
        ll_gissqft: parsed.ll_gissqft,
        zoning: parsed.zoning,
        zoning_description: parsed.zoning_description,
        usps_vacancy: parsed.usps_vacancy,
        qoz: parsed.qoz,
        rawData: JSON.parse(JSON.stringify(parsed.rawData)) ?? undefined,
        geometry: parsed.geometry ? JSON.parse(JSON.stringify(parsed.geometry)) : undefined,
        regridFetchedAt: new Date(),
      },
      update: {
        parcelnumb: parsed.parcelnumb,
        address: parsed.address,
        city: parsed.city,
        state: parsed.state,
        zip: parsed.zip,
        county: parsed.county,
        lat: parsed.lat,
        lng: parsed.lng,
        owner: parsed.owner,
        owntype: parsed.owntype,
        ownfrst: parsed.ownfrst,
        ownlast: parsed.ownlast,
        mailadd: parsed.mailadd,
        mailcity: parsed.mailcity,
        mailstate: parsed.mailstate,
        mailzip: parsed.mailzip,
        isAbsentee: parsed.isAbsentee,
        isVacant: parsed.isVacant,
        parval: parsed.parval,
        landval: parsed.landval,
        improvval: parsed.improvval,
        saleprice: parsed.saleprice,
        saledate: parsed.saledate,
        taxamt: parsed.taxamt,
        yearbuilt: parsed.yearbuilt,
        numstories: parsed.numstories,
        numunits: parsed.numunits,
        num_bedrooms: parsed.num_bedrooms,
        num_bath: parsed.num_bath,
        struct: parsed.struct,
        ll_gisacre: parsed.ll_gisacre,
        ll_gissqft: parsed.ll_gissqft,
        zoning: parsed.zoning,
        zoning_description: parsed.zoning_description,
        usps_vacancy: parsed.usps_vacancy,
        qoz: parsed.qoz,
        rawData: JSON.parse(JSON.stringify(parsed.rawData)) ?? undefined,
        geometry: parsed.geometry ? JSON.parse(JSON.stringify(parsed.geometry)) : undefined,
        regridFetchedAt: new Date(),
      },
    });

    return NextResponse.json({ parcel, cached: false });
  } catch (err) {
    console.error("[Regrid Lookup]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Lookup failed" },
      { status: 500 }
    );
  }
}
