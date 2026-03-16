import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * POST /api/dispatch/driver/location — GPS ping (every 30s when active)
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "LOGIN_REQUIRED" }, { status: 401 });
  }

  const body = await request.json();
  const { lat, lng } = body;

  if (lat == null || lng == null) {
    return NextResponse.json({ error: "lat and lng required" }, { status: 400 });
  }

  await prisma.deliveryDriver.updateMany({
    where: { userId: session.user.id, status: "approved" },
    data: {
      currentLat: lat,
      currentLng: lng,
      lastLocationAt: new Date(),
    },
  });

  return NextResponse.json({ ok: true });
}
