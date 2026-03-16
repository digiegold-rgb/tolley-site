import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

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
  const body = await request.json();
  const { stars, comment, tags } = body;

  if (!stars || stars < 1 || stars > 5) {
    return NextResponse.json({ error: "Stars must be 1-5" }, { status: 400 });
  }

  const order = await prisma.deliveryOrder.findUnique({ where: { id } });
  if (!order || order.status !== "completed") {
    return NextResponse.json(
      { error: "Order not found or not completed" },
      { status: 404 }
    );
  }

  // Determine rater type
  const client = await prisma.deliveryClient.findUnique({
    where: { userId: session.user.id },
  });
  const driver = await prisma.deliveryDriver.findUnique({
    where: { userId: session.user.id },
  });

  let raterType: string;
  let raterId: string;

  if (client?.id === order.clientId) {
    raterType = "client";
    raterId = client.id;
  } else if (driver?.id === order.driverId) {
    raterType = "driver";
    raterId = driver.id;
  } else {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const rating = await prisma.deliveryRating.create({
    data: {
      orderId: id,
      raterType,
      raterId,
      stars,
      comment: comment || null,
      tags: tags || [],
    },
  });

  // Update driver's average rating if client rated the driver
  if (raterType === "client" && order.driverId) {
    const allRatings = await prisma.deliveryRating.findMany({
      where: {
        raterType: "client",
        order: { driverId: order.driverId },
      },
      select: { stars: true },
    });
    const avg =
      allRatings.reduce((sum, r) => sum + r.stars, 0) / allRatings.length;
    await prisma.deliveryDriver.update({
      where: { id: order.driverId },
      data: {
        avgRating: Math.round(avg * 100) / 100,
        totalRatings: allRatings.length,
      },
    });
  }

  return NextResponse.json(rating, { status: 201 });
}
