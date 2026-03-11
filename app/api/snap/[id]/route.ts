import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const snap = await prisma.snapRequest.findUnique({
    where: { id },
  });

  if (!snap || snap.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Load dossier data if available
  let dossier = null;
  let listing = null;

  if (snap.dossierJobId) {
    const job = await prisma.dossierJob.findUnique({
      where: { id: snap.dossierJobId },
      include: { result: true },
    });

    if (job) {
      dossier = {
        jobId: job.id,
        status: job.status,
        progress: job.progress,
        currentStep: job.currentStep,
        stepsCompleted: job.stepsCompleted,
        stepsFailed: job.stepsFailed,
        result: job.result
          ? {
              owners: job.result.owners,
              entityType: job.result.entityType,
              entityName: job.result.entityName,
              courtCases: job.result.courtCases,
              liens: job.result.liens,
              bankruptcies: job.result.bankruptcies,
              taxRecords: job.result.taxRecords,
              deedHistory: job.result.deedHistory,
              socialProfiles: job.result.socialProfiles,
              webMentions: job.result.webMentions,
              relatedPeople: job.result.relatedPeople,
              streetViewUrl: job.result.streetViewUrl,
              satelliteUrl: job.result.satelliteUrl,
              neighborhoodPhotos: job.result.neighborhoodPhotos,
              motivationScore: job.result.motivationScore,
              motivationFlags: job.result.motivationFlags,
              financialData: job.result.financialData,
              pluginData: job.result.pluginData,
            }
          : null,
      };
    }
  }

  if (snap.listingId) {
    const l = await prisma.listing.findUnique({
      where: { id: snap.listingId },
      include: { enrichment: true },
    });
    if (l) {
      listing = {
        id: l.id,
        address: l.address,
        city: l.city,
        state: l.state,
        zip: l.zip,
        beds: l.beds,
        baths: l.baths,
        sqft: l.sqft,
        propertyType: l.propertyType,
        listPrice: l.listPrice,
        photoUrls: l.photoUrls,
        enrichment: l.enrichment
          ? {
              buyScore: l.enrichment.buyScore,
              taxBurdenRating: l.enrichment.taxBurdenRating,
              estimatedAnnualTax: l.enrichment.estimatedAnnualTax,
              countyName: l.enrichment.countyName,
            }
          : null,
      };
    }
  }

  return NextResponse.json({
    id: snap.id,
    status: snap.status,
    photoUrl: snap.photoUrl,
    exifGps:
      snap.photoExifLat && snap.photoExifLng
        ? { lat: snap.photoExifLat, lng: snap.photoExifLng }
        : null,
    resolvedAddress: snap.resolvedAddress
      ? {
          address: snap.resolvedAddress,
          city: snap.resolvedCity,
          state: snap.resolvedState,
          zip: snap.resolvedZip,
          county: snap.resolvedCounty,
        }
      : null,
    estimatedEquity: snap.estimatedEquity,
    equityBreakdown: snap.equityBreakdown,
    listing,
    dossier,
    createdAt: snap.createdAt,
  });
}
