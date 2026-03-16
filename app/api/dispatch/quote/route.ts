import { NextRequest, NextResponse } from "next/server";
import { calculateQuote } from "@/lib/dispatch/pricing";
import { getDistance, geocodeAddress } from "@/lib/dispatch/geocode";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      pickupAddress,
      dropoffAddress,
      pickupLat,
      pickupLng,
      dropoffLat,
      dropoffLng,
      weightLbs,
      urgency,
      requiresTrailer,
      requiresTempControl,
      isFragile,
    } = body;

    // Resolve coordinates from addresses if not provided
    let pLat = pickupLat;
    let pLng = pickupLng;
    let dLat = dropoffLat;
    let dLng = dropoffLng;

    if ((!pLat || !pLng) && pickupAddress) {
      const geo = await geocodeAddress(pickupAddress);
      if (!geo) {
        return NextResponse.json(
          { error: "Could not geocode pickup address" },
          { status: 400 }
        );
      }
      pLat = geo.lat;
      pLng = geo.lng;
    }

    if ((!dLat || !dLng) && dropoffAddress) {
      const geo = await geocodeAddress(dropoffAddress);
      if (!geo) {
        return NextResponse.json(
          { error: "Could not geocode dropoff address" },
          { status: 400 }
        );
      }
      dLat = geo.lat;
      dLng = geo.lng;
    }

    if (!pLat || !pLng || !dLat || !dLng) {
      return NextResponse.json(
        { error: "Pickup and dropoff locations are required" },
        { status: 400 }
      );
    }

    // Get driving distance
    const distance = await getDistance(pLat, pLng, dLat, dLng);
    if (!distance) {
      return NextResponse.json(
        { error: "Could not calculate route distance" },
        { status: 400 }
      );
    }

    // Calculate quote
    const quote = calculateQuote({
      distanceMi: distance.distanceMi,
      weightLbs: weightLbs || undefined,
      urgency: urgency || "standard",
      requiresTrailer: !!requiresTrailer,
      requiresTempControl: !!requiresTempControl,
      isFragile: !!isFragile,
    });

    return NextResponse.json({
      ...quote,
      durationMin: distance.durationMin,
      pickupAddress: distance.originAddress,
      dropoffAddress: distance.destinationAddress,
      pickupLat: pLat,
      pickupLng: pLng,
      dropoffLat: dLat,
      dropoffLng: dLng,
    });
  } catch (err) {
    console.error("[dispatch/quote]", err);
    return NextResponse.json(
      { error: "Failed to generate quote" },
      { status: 500 }
    );
  }
}
