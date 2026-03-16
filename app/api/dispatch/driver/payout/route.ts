import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getStripeClient } from "@/lib/stripe";

export const runtime = "nodejs";

/**
 * POST /api/dispatch/driver/payout — Request instant payout
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "LOGIN_REQUIRED" }, { status: 401 });
  }

  const driver = await prisma.deliveryDriver.findUnique({
    where: { userId: session.user.id },
  });
  if (!driver) {
    return NextResponse.json({ error: "Not registered" }, { status: 404 });
  }
  if (!driver.stripeConnectId) {
    return NextResponse.json(
      { error: "Stripe Connect account required. Complete onboarding first." },
      { status: 400 }
    );
  }

  // Find available earnings
  const availableEarnings = await prisma.driverEarning.findMany({
    where: {
      driverId: driver.id,
      status: "available",
    },
  });

  const totalAmount = availableEarnings.reduce((sum, e) => sum + e.total, 0);
  if (totalAmount <= 0) {
    return NextResponse.json({ error: "No available earnings" }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const method = body.method === "instant" ? "instant" : "stripe_connect";

  try {
    const stripe = getStripeClient();

    // Create transfer to Connected account
    const transfer = await stripe.transfers.create({
      amount: Math.round(totalAmount * 100),
      currency: "usd",
      destination: driver.stripeConnectId,
      metadata: { driverId: driver.id },
    });

    // Create payout record
    const payout = await prisma.driverPayout.create({
      data: {
        driverId: driver.id,
        amount: totalAmount,
        method,
        stripeTransferId: transfer.id,
        status: "processing",
      },
    });

    // Mark earnings as paid out
    await prisma.driverEarning.updateMany({
      where: {
        id: { in: availableEarnings.map((e) => e.id) },
      },
      data: {
        status: "paid_out",
        paidOutAt: new Date(),
        payoutId: payout.id,
      },
    });

    // If instant payout requested, trigger it on the Connected account
    if (method === "instant") {
      try {
        await stripe.payouts.create(
          {
            amount: Math.round(totalAmount * 100),
            currency: "usd",
            method: "instant",
          },
          { stripeAccount: driver.stripeConnectId }
        );
      } catch (err) {
        console.error("[dispatch] Instant payout failed, falling back to standard:", err);
        // Standard transfer still went through
      }
    }

    return NextResponse.json({
      payout,
      amount: totalAmount,
      method,
    });
  } catch (err) {
    console.error("[dispatch] Payout error:", err);
    return NextResponse.json({ error: "Payout failed" }, { status: 500 });
  }
}
