import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { calculateQuote } from "@/lib/dispatch/pricing";
import { getDistance, geocodeAddress } from "@/lib/dispatch/geocode";
import { generateOrderNumber } from "@/lib/dispatch/order-number";
import { getStripeClient } from "@/lib/stripe";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * POST /api/dispatch/orders — Create a new delivery order
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "LOGIN_REQUIRED" }, { status: 401 });
  }

  const client = await prisma.deliveryClient.findUnique({
    where: { userId: session.user.id },
  });
  if (!client) {
    return NextResponse.json(
      { error: "Client profile required. Register at /drive/dashboard first." },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const {
      pickupAddress,
      dropoffAddress,
      pickupLat: pLatIn,
      pickupLng: pLngIn,
      dropoffLat: dLatIn,
      dropoffLng: dLngIn,
      pickupContactName,
      pickupContactPhone,
      pickupInstructions,
      dropoffContactName,
      dropoffContactPhone,
      dropoffInstructions,
      cargoDescription,
      cargoWeightLbs,
      requiresTrailer,
      requiresTempControl,
      isFragile,
      urgency,
      scheduledAt,
    } = body;

    if (!pickupAddress || !dropoffAddress || !cargoDescription) {
      return NextResponse.json(
        { error: "pickupAddress, dropoffAddress, and cargoDescription are required" },
        { status: 400 }
      );
    }

    // Geocode if needed
    let pLat = pLatIn, pLng = pLngIn, dLat = dLatIn, dLng = dLngIn;

    if (!pLat || !pLng) {
      const geo = await geocodeAddress(pickupAddress);
      if (!geo) return NextResponse.json({ error: "Could not geocode pickup" }, { status: 400 });
      pLat = geo.lat;
      pLng = geo.lng;
    }
    if (!dLat || !dLng) {
      const geo = await geocodeAddress(dropoffAddress);
      if (!geo) return NextResponse.json({ error: "Could not geocode dropoff" }, { status: 400 });
      dLat = geo.lat;
      dLng = geo.lng;
    }

    // Get distance
    const dist = await getDistance(pLat, pLng, dLat, dLng);
    if (!dist) {
      return NextResponse.json({ error: "Could not calculate route" }, { status: 400 });
    }

    // Calculate pricing
    const quote = calculateQuote({
      distanceMi: dist.distanceMi,
      weightLbs: cargoWeightLbs,
      urgency: urgency || "standard",
      requiresTrailer: !!requiresTrailer,
      requiresTempControl: !!requiresTempControl,
      isFragile: !!isFragile,
    });

    // Create Stripe payment intent (authorize only, capture after delivery)
    let stripePaymentIntentId: string | undefined;
    if (client.stripeCustomerId) {
      const stripe = getStripeClient();
      const pi = await stripe.paymentIntents.create({
        amount: Math.round(quote.clientPrice * 100),
        currency: "usd",
        customer: client.stripeCustomerId,
        capture_method: "manual",
        metadata: { product: "dispatch", clientId: client.id },
      });
      stripePaymentIntentId = pi.id;
    }

    // Create order
    const orderNumber = generateOrderNumber();
    const order = await prisma.deliveryOrder.create({
      data: {
        orderNumber,
        clientId: client.id,
        status: "pending",
        urgency: urgency || "standard",
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        pickupAddress,
        pickupLat: pLat,
        pickupLng: pLng,
        pickupContactName: pickupContactName || client.contactName,
        pickupContactPhone: pickupContactPhone || client.phone,
        pickupInstructions,
        dropoffAddress,
        dropoffLat: dLat,
        dropoffLng: dLng,
        dropoffContactName,
        dropoffContactPhone,
        dropoffInstructions,
        cargoDescription,
        cargoWeightLbs: cargoWeightLbs || null,
        requiresTrailer: !!requiresTrailer,
        requiresTempControl: !!requiresTempControl,
        isFragile: !!isFragile,
        distanceMi: dist.distanceMi,
        durationMin: dist.durationMin,
        clientPrice: quote.clientPrice,
        platformFee: quote.platformFee,
        driverPay: quote.driverPay,
        industryEstimate: quote.industryEstimate,
        clientSavings: quote.clientSavings,
        stripePaymentIntentId,
        paymentStatus: stripePaymentIntentId ? "authorized" : "pending",
      },
    });

    // Update client stats
    await prisma.deliveryClient.update({
      where: { id: client.id },
      data: { totalOrders: { increment: 1 } },
    });

    return NextResponse.json(order, { status: 201 });
  } catch (err) {
    console.error("[dispatch/orders] POST:", err);
    return NextResponse.json({ error: "Failed to create order" }, { status: 500 });
  }
}

/**
 * GET /api/dispatch/orders — List client's orders
 */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "LOGIN_REQUIRED" }, { status: 401 });
  }

  const client = await prisma.deliveryClient.findUnique({
    where: { userId: session.user.id },
  });
  if (!client) {
    return NextResponse.json({ error: "Client profile required" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100);
  const offset = parseInt(searchParams.get("offset") || "0");

  const orders = await prisma.deliveryOrder.findMany({
    where: {
      clientId: client.id,
      ...(status ? { status } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    skip: offset,
    include: {
      driver: { select: { name: true, phone: true, vehicleType: true, avgRating: true } },
    },
  });

  return NextResponse.json({ orders, count: orders.length });
}
