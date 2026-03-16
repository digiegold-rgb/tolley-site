import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * PUT /api/dispatch/driver/status — Toggle online/offline + update GPS
 */
export async function PUT(request: NextRequest) {
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
  if (driver.status !== "approved") {
    return NextResponse.json({ error: "Driver not approved" }, { status: 403 });
  }

  const body = await request.json();
  const { isOnline, lat, lng } = body;

  const updated = await prisma.deliveryDriver.update({
    where: { id: driver.id },
    data: {
      ...(typeof isOnline === "boolean" && { isOnline }),
      ...(lat != null && { currentLat: lat }),
      ...(lng != null && { currentLng: lng }),
      lastLocationAt: new Date(),
    },
  });

  return NextResponse.json({
    isOnline: updated.isOnline,
    currentLat: updated.currentLat,
    currentLng: updated.currentLng,
  });
}
