import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { DISPATCH_STATUS } from "@/lib/dispatch/constants";
import {
  notifyClientAccepted,
  notifyDriverOrderTaken,
} from "@/lib/dispatch/sms";

export const runtime = "nodejs";

export async function POST(
  _request: NextRequest,
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

  // Atomically claim the order (only if still matching/pending)
  const order = await prisma.deliveryOrder.findUnique({ where: { id } });
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  if (
    order.status !== DISPATCH_STATUS.MATCHING &&
    order.status !== DISPATCH_STATUS.PENDING
  ) {
    return NextResponse.json(
      { error: "Order already taken or not available" },
      { status: 409 }
    );
  }

  const updated = await prisma.deliveryOrder.update({
    where: { id, status: { in: [DISPATCH_STATUS.MATCHING, DISPATCH_STATUS.PENDING] } },
    data: {
      driverId: driver.id,
      status: DISPATCH_STATUS.ACCEPTED,
      acceptedAt: new Date(),
    },
  });

  // Notify client
  const client = await prisma.deliveryClient.findUnique({
    where: { id: order.clientId },
  });
  if (client) {
    notifyClientAccepted(
      client.phone,
      driver.name,
      order.durationMin,
      order.orderNumber
    );
  }

  return NextResponse.json(updated);
}
