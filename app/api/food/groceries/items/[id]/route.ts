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

  const item = await prisma.foodGroceryItem.findFirst({
    where: { id },
    include: { list: { select: { householdId: true } } },
  });
  if (!item || item.list.householdId !== household.id)
    return NextResponse.json({ error: "Item not found" }, { status: 404 });

  const body = await request.json();
  const { quantity, unit, isChecked, category, aisle, estimatedPrice, name } = body;

  const updated = await prisma.foodGroceryItem.update({
    where: { id },
    data: {
      ...(name !== undefined && { name }),
      ...(quantity !== undefined && { quantity: Number(quantity) }),
      ...(unit !== undefined && { unit }),
      ...(isChecked !== undefined && { isChecked: Boolean(isChecked) }),
      ...(category !== undefined && { category }),
      ...(aisle !== undefined && { aisle }),
      ...(estimatedPrice !== undefined && {
        estimatedPrice: Number(estimatedPrice),
      }),
    },
  });

  return NextResponse.json({ item: updated });
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

  const item = await prisma.foodGroceryItem.findFirst({
    where: { id },
    include: { list: { select: { householdId: true } } },
  });
  if (!item || item.list.householdId !== household.id)
    return NextResponse.json({ error: "Item not found" }, { status: 404 });

  await prisma.foodGroceryItem.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
