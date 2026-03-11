/**
 * POST /api/regrid/scan
 * Bulk scan zip codes for parcels. Creates off-market leads for high-scoring parcels.
 */

import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { scanZipCode, type ParsedParcel } from "@/lib/regrid";
import { scoreParcel, shouldCreateParcelLead } from "@/lib/lead-scoring";

const prisma = new PrismaClient();

export async function POST(req: NextRequest) {
  const syncSecret = req.headers.get("x-sync-secret");
  if (!syncSecret || syncSecret !== process.env.SYNC_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { zips, filters } = body as {
    zips: string[];
    filters?: {
      absenteeOnly?: boolean;
      vacantOnly?: boolean;
      minValue?: number;
      maxValue?: number;
    };
  };

  if (!zips?.length) {
    return NextResponse.json({ error: "Provide at least one zip code" }, { status: 400 });
  }

  const startTime = Date.now();
  let totalParcels = 0;
  let newParcels = 0;
  let updatedParcels = 0;
  let leadsCreated = 0;
  let linkedToListings = 0;

  try {
    for (const zip of zips) {
      console.log(`[Regrid Scan] Scanning zip ${zip}...`);

      const parcels = await scanZipCode(zip, {
        absenteeOnly: filters?.absenteeOnly,
        vacantOnly: filters?.vacantOnly,
        minValue: filters?.minValue,
        maxValue: filters?.maxValue,
        returnGeometry: false, // Save billing — skip polygons
      });

      totalParcels += parcels.length;

      for (const parsed of parcels) {
        // Upsert parcel
        const existing = await prisma.parcel.findUnique({
          where: { regridId: parsed.regridId },
        });

        const parcel = await prisma.parcel.upsert({
          where: { regridId: parsed.regridId },
          create: buildParcelData(parsed),
          update: buildParcelUpdate(parsed),
        });

        if (existing) {
          updatedParcels++;
        } else {
          newParcels++;
        }

        // Cross-reference against Listing table (address match)
        if (!parcel.listingId) {
          const matchedListing = await prisma.listing.findFirst({
            where: {
              address: { contains: parsed.address.split(",")[0].trim(), mode: "insensitive" },
              zip: parsed.zip || undefined,
            },
            select: { id: true },
          });

          if (matchedListing) {
            await prisma.parcel.update({
              where: { id: parcel.id },
              data: { listingId: matchedListing.id },
            });
            linkedToListings++;
            continue; // Has MLS listing — not off-market
          }
        } else {
          continue; // Already linked to a listing
        }

        // Score for off-market lead generation
        const scoreResult = scoreParcel(parsed);
        if (shouldCreateParcelLead(scoreResult)) {
          // Check if lead already exists for this parcel
          const existingLead = await prisma.lead.findFirst({
            where: { parcelId: parcel.id },
          });

          if (!existingLead) {
            await prisma.lead.create({
              data: {
                parcelId: parcel.id,
                score: scoreResult.score,
                scoreFactors: scoreResult.factors,
                source: scoreResult.source,
                notes: scoreResult.summary,
                ownerName: parsed.owner,
              },
            });
            leadsCreated++;
          }
        }
      }
    }

    // Log the sync
    await prisma.syncLog.create({
      data: {
        source: "regrid",
        recordsTotal: totalParcels,
        recordsNew: newParcels,
        recordsUpdated: updatedParcels,
        duration: Date.now() - startTime,
      },
    });

    return NextResponse.json({
      totalParcels,
      newParcels,
      updatedParcels,
      leadsCreated,
      linkedToListings,
      duration: Date.now() - startTime,
    });
  } catch (err) {
    console.error("[Regrid Scan]", err);

    await prisma.syncLog.create({
      data: {
        source: "regrid",
        recordsTotal: totalParcels,
        recordsNew: newParcels,
        recordsUpdated: updatedParcels,
        duration: Date.now() - startTime,
        error: err instanceof Error ? err.message : "Scan failed",
      },
    });

    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Scan failed" },
      { status: 500 }
    );
  }
}

function buildParcelData(p: ParsedParcel) {
  return {
    regridId: p.regridId,
    parcelnumb: p.parcelnumb,
    address: p.address,
    city: p.city,
    state: p.state,
    zip: p.zip,
    county: p.county,
    lat: p.lat,
    lng: p.lng,
    owner: p.owner,
    owntype: p.owntype,
    ownfrst: p.ownfrst,
    ownlast: p.ownlast,
    mailadd: p.mailadd,
    mailcity: p.mailcity,
    mailstate: p.mailstate,
    mailzip: p.mailzip,
    isAbsentee: p.isAbsentee,
    isVacant: p.isVacant,
    parval: p.parval,
    landval: p.landval,
    improvval: p.improvval,
    saleprice: p.saleprice,
    saledate: p.saledate,
    taxamt: p.taxamt,
    yearbuilt: p.yearbuilt,
    numstories: p.numstories,
    numunits: p.numunits,
    num_bedrooms: p.num_bedrooms,
    num_bath: p.num_bath,
    struct: p.struct,
    ll_gisacre: p.ll_gisacre,
    ll_gissqft: p.ll_gissqft,
    zoning: p.zoning,
    zoning_description: p.zoning_description,
    usps_vacancy: p.usps_vacancy,
    qoz: p.qoz,
    rawData: JSON.parse(JSON.stringify(p.rawData)) ?? undefined,
    regridFetchedAt: new Date(),
  };
}

function buildParcelUpdate(p: ParsedParcel) {
  return {
    parcelnumb: p.parcelnumb,
    address: p.address,
    city: p.city,
    state: p.state,
    zip: p.zip,
    county: p.county,
    lat: p.lat,
    lng: p.lng,
    owner: p.owner,
    owntype: p.owntype,
    ownfrst: p.ownfrst,
    ownlast: p.ownlast,
    mailadd: p.mailadd,
    mailcity: p.mailcity,
    mailstate: p.mailstate,
    mailzip: p.mailzip,
    isAbsentee: p.isAbsentee,
    isVacant: p.isVacant,
    parval: p.parval,
    landval: p.landval,
    improvval: p.improvval,
    saleprice: p.saleprice,
    saledate: p.saledate,
    taxamt: p.taxamt,
    yearbuilt: p.yearbuilt,
    numstories: p.numstories,
    numunits: p.numunits,
    num_bedrooms: p.num_bedrooms,
    num_bath: p.num_bath,
    struct: p.struct,
    ll_gisacre: p.ll_gisacre,
    ll_gissqft: p.ll_gissqft,
    zoning: p.zoning,
    zoning_description: p.zoning_description,
    usps_vacancy: p.usps_vacancy,
    qoz: p.qoz,
    rawData: JSON.parse(JSON.stringify(p.rawData)) ?? undefined,
    regridFetchedAt: new Date(),
  };
}
