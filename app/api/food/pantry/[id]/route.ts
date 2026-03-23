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

  const existing = await prisma.foodPantryItem.findFirst({
    where: { id, householdId: household.id },
  });
  if (!existing)
    return NextResponse.json({ error: "Item not found" }, { status: 404 });

  const body = await request.json();
  const { name, quantity, unit, status, expiresAt, location, category, autoRestock } =
    body;

  const item = await prisma.foodPantryItem.update({
    where: { id },
    data: {
      ...(name !== undefined && { name }),
      ...(quantity !== undefined && { quantity: Number(quantity) }),
      ...(unit !== undefined && { unit }),
      ...(status !== undefined && { status }),
      ...(expiresAt !== undefined && {
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      }),
      ...(location !== undefined && { location }),
      ...(category !== undefined && { category }),
      ...(autoRestock !== undefined && { autoRestock: Boolean(autoRestock) }),
    },
  });

  return NextResponse.json({ item });
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

  const existing = await prisma.foodPantryItem.findFirst({
    where: { id, householdId: household.id },
  });
  if (!existing)
    return NextResponse.json({ error: "Item not found" }, { status: 404 });

  await prisma.foodPantryItem.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
