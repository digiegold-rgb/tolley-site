import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "LOGIN_REQUIRED" }, { status: 401 });
  }

  const client = await prisma.deliveryClient.findUnique({
    where: { userId: session.user.id },
    include: { locations: true },
  });

  if (!client) {
    return NextResponse.json({ error: "No client profile" }, { status: 404 });
  }

  return NextResponse.json(client);
}

export async function PUT(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "LOGIN_REQUIRED" }, { status: 401 });
  }

  const body = await request.json();
  const { businessName, contactName, phone, defaultPickupAddress, defaultPickupLat, defaultPickupLng } = body;

  const client = await prisma.deliveryClient.upsert({
    where: { userId: session.user.id },
    create: {
      userId: session.user.id,
      contactName: contactName || session.user.name || "Client",
      phone: phone || "",
      businessName,
      defaultPickupAddress,
      defaultPickupLat,
      defaultPickupLng,
    },
    update: {
      ...(businessName !== undefined && { businessName }),
      ...(contactName !== undefined && { contactName }),
      ...(phone !== undefined && { phone }),
      ...(defaultPickupAddress !== undefined && { defaultPickupAddress }),
      ...(defaultPickupLat !== undefined && { defaultPickupLat }),
      ...(defaultPickupLng !== undefined && { defaultPickupLng }),
    },
  });

  return NextResponse.json(client);
}
