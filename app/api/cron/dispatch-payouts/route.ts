import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getStripeClient } from "@/lib/stripe";

export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * Cron: daily at 6 AM — process driver payouts
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && process.env.VERCEL) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Find drivers with available earnings and Stripe Connect
    const driversWithEarnings = await prisma.deliveryDriver.findMany({
      where: {
        stripeConnectId: { not: null },
        earnings: {
          some: { status: "available" },
        },
      },
      include: {
        earnings: {
          where: { status: "available" },
        },
      },
    });

    const stripe = getStripeClient();
    let processed = 0;
    let totalAmount = 0;

    for (const driver of driversWithEarnings) {
      const amount = driver.earnings.reduce((sum, e) => sum + e.total, 0);
      if (amount <= 0 || !driver.stripeConnectId) continue;

      try {
        const transfer = await stripe.transfers.create({
          amount: Math.round(amount * 100),
          currency: "usd",
          destination: driver.stripeConnectId,
          metadata: { driverId: driver.id, type: "daily_payout" },
        });

        const payout = await prisma.driverPayout.create({
          data: {
            driverId: driver.id,
            amount,
            method: "stripe_connect",
            stripeTransferId: transfer.id,
            status: "completed",
            completedAt: new Date(),
          },
        });

        await prisma.driverEarning.updateMany({
          where: {
            id: { in: driver.earnings.map((e) => e.id) },
          },
          data: {
            status: "paid_out",
            paidOutAt: new Date(),
            payoutId: payout.id,
          },
        });

        processed++;
        totalAmount += amount;
      } catch (err) {
        console.error(`[payout] Failed for driver ${driver.id}:`, err);
      }
    }

    return NextResponse.json({
      ok: true,
      driversProcessed: processed,
      totalAmount: Math.round(totalAmount * 100) / 100,
    });
  } catch (err) {
    console.error("[cron/dispatch-payouts]", err);
    return NextResponse.json({ error: "Payout cron failed" }, { status: 500 });
  }
}
