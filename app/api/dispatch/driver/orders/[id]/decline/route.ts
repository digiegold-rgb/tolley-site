import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

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

  // Just acknowledge — matching cron will handle retries
  // Log the decline in the order's aiDispatchLog
  const order = await prisma.deliveryOrder.findUnique({ where: { id } });
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const driver = await prisma.deliveryDriver.findUnique({
    where: { userId: session.user.id },
  });

  const log = order.aiDispatchLog
    ? JSON.parse(order.aiDispatchLog)
    : [];
  log.push({
    event: "declined",
    driverId: driver?.id,
    driverName: driver?.name,
    at: new Date().toISOString(),
  });

  await prisma.deliveryOrder.update({
    where: { id },
    data: { aiDispatchLog: JSON.stringify(log) },
  });

  return NextResponse.json({ ok: true });
}
