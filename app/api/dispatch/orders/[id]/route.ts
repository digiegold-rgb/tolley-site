import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * GET /api/dispatch/orders/[id] — Order detail
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Allow public access by orderNumber (for tracking page)
  const isOrderNumber = id.startsWith("RAD-");
  const order = await prisma.deliveryOrder.findFirst({
    where: isOrderNumber ? { orderNumber: id } : { id },
    include: {
      driver: {
        select: {
          name: true,
          phone: true,
          vehicleType: true,
          vehicleDetails: true,
          avgRating: true,
          currentLat: true,
          currentLng: true,
        },
      },
      ratings: true,
    },
  });

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  // If not public tracking (by orderNumber), verify auth
  if (!isOrderNumber) {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "LOGIN_REQUIRED" }, { status: 401 });
    }

    const client = await prisma.deliveryClient.findUnique({
      where: { userId: session.user.id },
    });
    const driver = await prisma.deliveryDriver.findUnique({
      where: { userId: session.user.id },
    });

    const isOwner = client?.id === order.clientId;
    const isDriver = driver?.id === order.driverId;
    if (!isOwner && !isDriver) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }
  }

  return NextResponse.json(order);
}
