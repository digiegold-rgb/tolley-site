import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * GET /api/dispatch/driver/orders — Available + active orders for driver
 */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "LOGIN_REQUIRED" }, { status: 401 });
  }

  const driver = await prisma.deliveryDriver.findUnique({
    where: { userId: session.user.id },
  });
  if (!driver || driver.status !== "approved") {
    return NextResponse.json({ error: "Not an approved driver" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") || "active"; // active | history

  if (type === "history") {
    const orders = await prisma.deliveryOrder.findMany({
      where: {
        driverId: driver.id,
        status: { in: ["completed", "cancelled", "failed"] },
      },
      orderBy: { completedAt: "desc" },
      take: 50,
    });
    return NextResponse.json({ orders });
  }

  // Active orders assigned to this driver
  const active = await prisma.deliveryOrder.findMany({
    where: {
      driverId: driver.id,
      status: {
        in: ["accepted", "pickup_enroute", "picked_up", "delivering", "delivered"],
      },
    },
    orderBy: { acceptedAt: "desc" },
  });

  return NextResponse.json({ orders: active });
}
