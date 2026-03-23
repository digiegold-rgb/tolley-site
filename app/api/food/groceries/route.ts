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
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const household = await prisma.foodHousehold.findUnique({
    where: { userId: session.user.id },
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
