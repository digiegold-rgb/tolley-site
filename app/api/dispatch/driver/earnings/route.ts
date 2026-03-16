import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
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

  const { searchParams } = new URL(request.url);
  const period = searchParams.get("period") || "week"; // week, month, all

  const now = new Date();
  let since: Date;
  if (period === "week") {
    since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  } else if (period === "month") {
    since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  } else {
    since = new Date(0);
  }

  const earnings = await prisma.driverEarning.findMany({
    where: {
      driverId: driver.id,
      createdAt: { gte: since },
    },
    orderBy: { createdAt: "desc" },
    include: {
      order: {
        select: {
          orderNumber: true,
          pickupAddress: true,
          dropoffAddress: true,
          distanceMi: true,
          completedAt: true,
        },
      },
    },
  });

  const totalEarned = earnings.reduce((sum, e) => sum + e.total, 0);
  const totalTips = earnings.reduce((sum, e) => sum + e.tip, 0);
  const available = earnings
    .filter((e) => e.status === "available")
    .reduce((sum, e) => sum + e.total, 0);
  const pending = earnings
    .filter((e) => e.status === "pending")
    .reduce((sum, e) => sum + e.total, 0);

  return NextResponse.json({
    earnings,
    summary: {
      totalEarned: Math.round(totalEarned * 100) / 100,
      totalTips: Math.round(totalTips * 100) / 100,
      available: Math.round(available * 100) / 100,
      pending: Math.round(pending * 100) / 100,
      deliveries: earnings.length,
    },
  });
}
