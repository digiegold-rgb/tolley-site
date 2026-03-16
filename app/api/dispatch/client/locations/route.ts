import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "LOGIN_REQUIRED" }, { status: 401 });
  }

  const client = await prisma.deliveryClient.findUnique({
    where: { userId: session.user.id },
  });
  if (!client) {
    return NextResponse.json({ error: "Client profile required" }, { status: 403 });
  }

  const body = await request.json();
  const { label, address, lat, lng, isPickup } = body;

  if (!label || !address || lat == null || lng == null) {
    return NextResponse.json(
      { error: "label, address, lat, lng are required" },
      { status: 400 }
    );
  }

  const location = await prisma.savedLocation.create({
    data: {
      clientId: client.id,
      label,
      address,
      lat,
      lng,
      isPickup: isPickup ?? true,
    },
  });

  return NextResponse.json(location, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "LOGIN_REQUIRED" }, { status: 401 });
  }

  const client = await prisma.deliveryClient.findUnique({
    where: { userId: session.user.id },
  });
  if (!client) {
    return NextResponse.json({ error: "Client profile required" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const locationId = searchParams.get("id");
  if (!locationId) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  await prisma.savedLocation.deleteMany({
    where: { id: locationId, clientId: client.id },
  });

  return NextResponse.json({ deleted: true });
}
