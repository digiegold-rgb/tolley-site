import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "LOGIN_REQUIRED" }, { status: 401 });
  }

  const driver = await prisma.deliveryDriver.findUnique({
    where: { userId: session.user.id },
  });

  if (!driver) {
    return NextResponse.json({ error: "Not registered as driver" }, { status: 404 });
  }

  return NextResponse.json(driver);
}

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

  const body = await request.json();
  const allowedFields = [
    "name", "phone", "vehicleType", "vehicleDetails",
    "maxWeightLbs", "homeZip", "serviceRadiusMi",
  ] as const;

  const updates: Record<string, unknown> = {};
  for (const field of allowedFields) {
    if (body[field] !== undefined) updates[field] = body[field];
  }

  const updated = await prisma.deliveryDriver.update({
    where: { id: driver.id },
    data: updates,
  });

  return NextResponse.json(updated);
}
