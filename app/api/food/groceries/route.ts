// Food API route
import { NextRequest, NextResponse } from "next/server";
import { getFoodApiUserId } from "@/lib/food/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const userId = await getFoodApiUserId();
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const household = await prisma.foodHousehold.findUnique({
    where: { userId: userId },
  });
  if (!household)
    return NextResponse.json({ error: "No household" }, { status: 404 });

  const lists = await prisma.foodGroceryList.findMany({
    where: { householdId: household.id },
    include: {
      items: true,
      _count: { select: { items: true } },
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });

  // Add `name` alias for `store` for compatibility
  const listsWithName = lists.map((l) => ({
    ...l,
    name: l.store || "Shopping List",
  }));

  return NextResponse.json({ lists: listsWithName });
}

export async function POST(request: NextRequest) {
  const userId = await getFoodApiUserId();
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const household = await prisma.foodHousehold.findUnique({
    where: { userId: userId },
  });
  if (!household)
    return NextResponse.json({ error: "No household" }, { status: 404 });

  const body = await request.json();
  const { store, planId } = body;

  const list = await prisma.foodGroceryList.create({
    data: {
      householdId: household.id,
      store: store || null,
      planId: planId || null,
    },
    include: { items: true },
  });

  return NextResponse.json({ list }, { status: 201 });
}
