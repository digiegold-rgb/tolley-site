import { NextResponse } from "next/server";
import { requireAdminApiSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
  const check = await requireAdminApiSession();
  if (!check.ok) return check.response;

  const [
    totalOrders,
    pendingOrders,
    activeOrders,
    completedOrders,
    totalDrivers,
    onlineDrivers,
    pendingDrivers,
    totalClients,
    totalRevenue,
  ] = await Promise.all([
    prisma.deliveryOrder.count(),
    prisma.deliveryOrder.count({ where: { status: { in: ["pending", "matching"] } } }),
    prisma.deliveryOrder.count({
      where: { status: { in: ["accepted", "pickup_enroute", "picked_up", "delivering"] } },
    }),
    prisma.deliveryOrder.count({ where: { status: "completed" } }),
    prisma.deliveryDriver.count(),
    prisma.deliveryDriver.count({ where: { isOnline: true, status: "approved" } }),
    prisma.deliveryDriver.count({ where: { status: "pending" } }),
    prisma.deliveryClient.count(),
    prisma.deliveryOrder.aggregate({
      where: { status: "completed" },
      _sum: { platformFee: true },
    }),
  ]);

  // Recent orders
  const recentOrders = await prisma.deliveryOrder.findMany({
    orderBy: { createdAt: "desc" },
    take: 10,
    include: {
      driver: { select: { name: true } },
    },
  });

  return NextResponse.json({
    stats: {
      totalOrders,
      pendingOrders,
      activeOrders,
      completedOrders,
      totalDrivers,
      onlineDrivers,
      pendingDrivers,
      totalClients,
      totalRevenue: totalRevenue._sum.platformFee || 0,
    },
    recentOrders,
  });
}
