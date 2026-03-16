import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getStripeClient } from "@/lib/stripe";
import { DISPATCH_STATUS } from "@/lib/dispatch/constants";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "LOGIN_REQUIRED" }, { status: 401 });
  }

  const { id } = await params;
  const client = await prisma.deliveryClient.findUnique({
    where: { userId: session.user.id },
  });
  if (!client) {
    return NextResponse.json({ error: "Client profile required" }, { status: 403 });
  }

  const order = await prisma.deliveryOrder.findFirst({
    where: { id, clientId: client.id },
  });
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const cancellable = [
    DISPATCH_STATUS.PENDING,
    DISPATCH_STATUS.MATCHING,
    DISPATCH_STATUS.ACCEPTED,
  ];
  if (!cancellable.includes(order.status as typeof cancellable[number])) {
    return NextResponse.json(
      { error: "Order cannot be cancelled in current status" },
      { status: 400 }
    );
  }

  const body = await request.json().catch(() => ({}));

  // Refund Stripe auth hold if exists
  if (order.stripePaymentIntentId) {
    try {
      const stripe = getStripeClient();
      await stripe.paymentIntents.cancel(order.stripePaymentIntentId);
    } catch (err) {
      console.error("[dispatch] Stripe cancel failed:", err);
    }
  }

  const updated = await prisma.deliveryOrder.update({
    where: { id },
    data: {
      status: DISPATCH_STATUS.CANCELLED,
      cancelledAt: new Date(),
      cancelReason: body.reason || "Client cancelled",
      paymentStatus: "refunded",
    },
  });

  return NextResponse.json(updated);
}
