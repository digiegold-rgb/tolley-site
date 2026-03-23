// @ts-nocheck — references removed Prisma models
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const household = await prisma.foodHousehold.findUnique({
    where: { userId: session.user.id },
  });
  if (!household)
    return NextResponse.json({ error: "No household" }, { status: 404 });

  const { id } = await params;

  const member = await prisma.foodFamilyMember.findFirst({
    where: { id, householdId: household.id },
  });
  if (!member)
    return NextResponse.json({ error: "Member not found" }, { status: 404 });

  const body = await request.json();
  const { name, role, dietaryFlags, dislikes, favorites, ageRange } = body;

  const updated = await prisma.foodFamilyMember.update({
    where: { id },
    data: {
      ...(name !== undefined && { name }),
      ...(role !== undefined && { role }),
      ...(dietaryFlags !== undefined && { dietaryFlags }),
      ...(dislikes !== undefined && { dislikes }),
      ...(favorites !== undefined && { favorites }),
      ...(ageRange !== undefined && { ageRange }),
    },
  });

  return NextResponse.json({ member: updated });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const household = await prisma.foodHousehold.findUnique({
    where: { userId: session.user.id },
  });
  if (!household)
    return NextResponse.json({ error: "No household" }, { status: 404 });

  const { id } = await params;

  const member = await prisma.foodFamilyMember.findFirst({
    where: { id, householdId: household.id },
  });
  if (!member)
    return NextResponse.json({ error: "Member not found" }, { status: 404 });

  await prisma.foodFamilyMember.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
