import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "LOGIN_REQUIRED" }, { status: 401 });
  }

  // Check if already registered
  const existing = await prisma.deliveryDriver.findUnique({
    where: { userId: session.user.id },
  });
  if (existing) {
    return NextResponse.json(
      { error: "Already registered", driver: existing },
      { status: 409 }
    );
  }

  const body = await request.json();
  const { name, phone, vehicleType, vehicleDetails, maxWeightLbs, homeZip, serviceRadiusMi } = body;

  if (!name || !phone || !vehicleType || !homeZip) {
    return NextResponse.json(
      { error: "name, phone, vehicleType, and homeZip are required" },
      { status: 400 }
    );
  }

  // Check phone uniqueness
  const phoneExists = await prisma.deliveryDriver.findUnique({ where: { phone } });
  if (phoneExists) {
    return NextResponse.json({ error: "Phone already registered" }, { status: 409 });
  }

  const driver = await prisma.deliveryDriver.create({
    data: {
      userId: session.user.id,
      name,
      phone,
      vehicleType,
      vehicleDetails: vehicleDetails || null,
      maxWeightLbs: maxWeightLbs || 500,
      homeZip,
      serviceRadiusMi: serviceRadiusMi || 30,
      status: "pending", // requires admin approval
    },
  });

  return NextResponse.json(driver, { status: 201 });
}
