import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { extractGpsFromPhoto } from "@/lib/snap/exif";
import { reverseGeocode } from "@/lib/snap/geocode";
import { processSnapRequest } from "@/lib/snap/pipeline";
import { after } from "next/server";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  // Check subscription tier + snap limit
  const subscriber = await prisma.leadSubscriber.findUnique({
    where: { userId },
  });

  if (!subscriber || subscriber.status !== "active") {
    return NextResponse.json(
      { error: "Active leads subscription required" },
      { status: 403 }
    );
  }

  if (subscriber.snapLimit <= 0) {
    return NextResponse.json(
      { error: "Snap & Know requires Pro or Team tier. Upgrade at /leads/pricing" },
      { status: 403 }
    );
  }

  if (subscriber.snapUsed >= subscriber.snapLimit) {
    return NextResponse.json(
      { error: `Monthly snap limit reached (${subscriber.snapLimit}). Resets next month.` },
      { status: 429 }
    );
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const browserLat = formData.get("browserLat") as string | null;
    const browserLng = formData.get("browserLng") as string | null;
    const manualAddress = formData.get("manualAddress") as string | null;

    if (!file && !manualAddress) {
      return NextResponse.json(
        { error: "Provide a photo or an address" },
        { status: 400 }
      );
    }

    let photoUrl = "";
    let exifGps: { lat: number; lng: number } | null = null;

    if (file) {
      // Validate file type
      if (!file.type.startsWith("image/")) {
        return NextResponse.json({ error: "Only images allowed" }, { status: 400 });
      }

      // Validate file size (10MB max)
      if (file.size > 10 * 1024 * 1024) {
        return NextResponse.json({ error: "File too large (10MB max)" }, { status: 400 });
      }

      // Extract EXIF GPS before uploading
      const buffer = await file.arrayBuffer();
      const gps = await extractGpsFromPhoto(buffer);
      if (gps) {
        exifGps = { lat: gps.lat, lng: gps.lng };
      }

      // Upload to Vercel Blob
      const blob = await put(`snap/${userId}/${Date.now()}-${file.name}`, file, {
        access: "public",
      });
      photoUrl = blob.url;
    }

    // Determine best available GPS
    const bestLat = exifGps?.lat ?? (browserLat ? parseFloat(browserLat) : null);
    const bestLng = exifGps?.lng ?? (browserLng ? parseFloat(browserLng) : null);

    // Quick reverse geocode if we have GPS (fast — <1s)
    let resolvedAddress: string | null = null;
    let resolvedCity: string | null = null;
    let resolvedState: string | null = null;
    let resolvedZip: string | null = null;
    let resolvedCounty: string | null = null;
    let initialStatus = "pending";

    if (bestLat && bestLng) {
      const geocoded = await reverseGeocode(bestLat, bestLng);
      if (geocoded) {
        resolvedAddress = geocoded.address;
        resolvedCity = geocoded.city;
        resolvedState = geocoded.state;
        resolvedZip = geocoded.zip;
        resolvedCounty = geocoded.county;
        initialStatus = "geocoded";
      }
    } else if (manualAddress) {
      resolvedAddress = manualAddress;
      initialStatus = "geocoded";
    }

    if (!resolvedAddress && !bestLat) {
      initialStatus = "needs_address";
    }

    // Create snap request
    const snap = await prisma.snapRequest.create({
      data: {
        userId,
        photoUrl: photoUrl || "",
        photoExifLat: exifGps?.lat,
        photoExifLng: exifGps?.lng,
        browserLat: browserLat ? parseFloat(browserLat) : null,
        browserLng: browserLng ? parseFloat(browserLng) : null,
        manualAddress,
        resolvedLat: bestLat,
        resolvedLng: bestLng,
        resolvedAddress,
        resolvedCity,
        resolvedState,
        resolvedZip,
        resolvedCounty,
        status: initialStatus,
      },
    });

    // Increment snap usage
    await prisma.leadSubscriber.update({
      where: { userId },
      data: { snapUsed: { increment: 1 } },
    });

    // If we have an address, start the pipeline in the background
    if (resolvedAddress) {
      after(async () => {
        await processSnapRequest(snap.id);
      });
    }

    return NextResponse.json({
      snapId: snap.id,
      photoUrl,
      exifGps,
      resolvedAddress: resolvedAddress
        ? {
            address: resolvedAddress,
            city: resolvedCity,
            state: resolvedState,
            zip: resolvedZip,
            county: resolvedCounty,
          }
        : null,
      status: initialStatus,
    });
  } catch (err) {
    console.error("[Snap] Upload error:", err);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
