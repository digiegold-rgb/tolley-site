// @ts-nocheck — references removed Prisma models
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
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

  const list = await prisma.foodGroceryList.findFirst({
    where: { id, householdId: household.id },
    include: {
      items: { orderBy: [{ aisle: "asc" }, { category: "asc" }, { name: "asc" }] },
    },
  });

  if (!list)
    return NextResponse.json({ error: "List not found" }, { status: 404 });

  // Group items by aisle
  const grouped: Record<string, typeof list.items> = {};
  for (const item of list.items) {
    const aisle = item.aisle || "Other";
    if (!grouped[aisle]) grouped[aisle] = [];
    grouped[aisle].push(item);
  }

  return NextResponse.json({ list, grouped });
}

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

  const existing = await prisma.foodGroceryList.findFirst({
    where: { id, householdId: household.id },
  });
  if (!existing)
    return NextResponse.json({ error: "List not found" }, { status: 404 });

  const body = await request.json();
  const { status, actualTotal } = body;

  const list = await prisma.foodGroceryList.update({
    where: { id },
    data: {
      ...(status !== undefined && { status }),
      ...(actualTotal !== undefined && { actualTotal: Number(actualTotal) }),
    },
  });

  return NextResponse.json({ list });
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

  const existing = await prisma.foodGroceryList.findFirst({
    where: { id, householdId: household.id },
  });
  if (!existing)
    return NextResponse.json({ error: "List not found" }, { status: 404 });

  await prisma.foodGroceryList.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
