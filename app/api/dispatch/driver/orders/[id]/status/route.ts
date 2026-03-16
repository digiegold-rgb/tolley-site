import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { DISPATCH_STATUS } from "@/lib/dispatch/constants";
import { notifyClientStatusUpdate } from "@/lib/dispatch/sms";
import { getStripeClient } from "@/lib/stripe";

export const runtime = "nodejs";

const STATUS_FLOW: Record<string, string> = {
  accepted: "pickup_enroute",
  pickup_enroute: "picked_up",
  picked_up: "delivering",
  delivering: "delivered",
  delivered: "completed",
};

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "LOGIN_REQUIRED" }, { status: 401 });
  }

  const { id } = await params;
  const driver = await prisma.deliveryDriver.findUnique({
    where: { userId: session.user.id },
  });
  if (!driver || driver.status !== "approved") {
    return NextResponse.json({ error: "Not an approved driver" }, { status: 403 });
  }

  const order = await prisma.deliveryOrder.findFirst({
    where: { id, driverId: driver.id },
  });
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const body = await request.json();
  const { status: newStatus, photoUrl } = body;

  // Validate status transition
  const expectedNext = STATUS_FLOW[order.status];
  if (!expectedNext) {
    return NextResponse.json({ error: "No further status updates possible" }, { status: 400 });
  }
  // Allow either the exact next step or the explicit status provided
  const targetStatus = newStatus || expectedNext;
  if (targetStatus !== expectedNext) {
    return NextResponse.json(
      { error: `Expected next status: ${expectedNext}, got: ${targetStatus}` },
      { status: 400 }
    );
  }

  const updates: Record<string, unknown> = { status: targetStatus };

  if (targetStatus === "picked_up") {
    updates.pickedUpAt = new Date();
    if (photoUrl) updates.pickupPhotoUrl = photoUrl;
  } else if (targetStatus === "delivered") {
    updates.deliveredAt = new Date();
    if (photoUrl) updates.dropoffPhotoUrl = photoUrl;
  } else if (targetStatus === "completed") {
    updates.completedAt = new Date();

    // Capture Stripe payment
    if (order.stripePaymentIntentId && order.paymentStatus === "authorized") {
      try {
        const stripe = getStripeClient();
        await stripe.paymentIntents.capture(order.stripePaymentIntentId);
        updates.paymentStatus = "captured";
      } catch (err) {
        console.error("[dispatch] Stripe capture failed:", err);
      }
    }

    // Create driver earning
    await prisma.driverEarning.create({
      data: {
        driverId: driver.id,
        orderId: order.id,
        amount: order.driverPay,
        total: order.driverPay,
        status: "available",
        availableAt: new Date(),
      },
    });

    // Update driver stats
    await prisma.deliveryDriver.update({
      where: { id: driver.id },
      data: {
        totalDeliveries: { increment: 1 },
      },
    });

    // Update client total spent
    await prisma.deliveryClient.update({
      where: { id: order.clientId },
      data: { totalSpent: { increment: order.clientPrice } },
    });
  }

  const updated = await prisma.deliveryOrder.update({
    where: { id },
    data: updates,
  });

  // Notify client
  const client = await prisma.deliveryClient.findUnique({
    where: { id: order.clientId },
  });
  if (client) {
    notifyClientStatusUpdate(client.phone, targetStatus, order.orderNumber);
  }

  return NextResponse.json(updated);
}
