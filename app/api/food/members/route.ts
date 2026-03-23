// @ts-nocheck — references removed Prisma models
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const household = await prisma.foodHousehold.findUnique({
    where: { userId: session.user.id },
  });
  if (!household)
    return NextResponse.json({ error: "No household" }, { status: 404 });

  const members = await prisma.foodFamilyMember.findMany({
    where: { householdId: household.id },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ members });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const household = await prisma.foodHousehold.findUnique({
    where: { userId: session.user.id },
  });
  if (!household)
    return NextResponse.json({ error: "No household" }, { status: 404 });

  const body = await request.json();
  const { name, role, dietaryFlags, dislikes, favorites, ageRange } = body;

  if (!name)
    return NextResponse.json({ error: "name is required" }, { status: 400 });

  const member = await prisma.foodFamilyMember.create({
    data: {
      householdId: household.id,
      name,
      role: role || "member",
      dietaryFlags: dietaryFlags || [],
      dislikes: dislikes || [],
      favorites: favorites || [],
      ageRange: ageRange || null,
    },
  });

  return NextResponse.json({ member }, { status: 201 });
}
