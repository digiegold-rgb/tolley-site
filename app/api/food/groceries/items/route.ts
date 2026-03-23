// @ts-nocheck — references removed Prisma models
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

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
  const { listId, items, name, quantity, unit, category } = body;

  if (!listId)
    return NextResponse.json({ error: "listId is required" }, { status: 400 });

  // Verify list ownership
  const list = await prisma.foodGroceryList.findFirst({
    where: { id: listId, householdId: household.id },
  });
  if (!list)
    return NextResponse.json({ error: "List not found" }, { status: 404 });

  // Handle bulk or single
  const itemsToCreate = items
    ? (items as { name: string; quantity: number; unit?: string; category?: string }[])
    : [{ name, quantity, unit, category }];

  if (!itemsToCreate[0]?.name)
    return NextResponse.json(
      { error: "At least one item with a name is required" },
      { status: 400 }
    );

  const created = await Promise.all(
    itemsToCreate.map(
      (item: { name: string; quantity: number; unit?: string; category?: string }) =>
        prisma.foodGroceryItem.create({
          data: {
            listId,
            name: item.name,
            quantity: item.quantity || 1,
            unit: item.unit || null,
            category: item.category || null,
            addedBy: "manual",
          },
        })
    )
  );

  return NextResponse.json({ items: created }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const household = await prisma.foodHousehold.findUnique({
    where: { userId: session.user.id },
  });
  if (!household)
    return NextResponse.json({ error: "No household" }, { status: 404 });

  const body = await request.json();
  const { itemIds, isChecked } = body;

  if (!Array.isArray(itemIds) || typeof isChecked !== "boolean")
    return NextResponse.json(
      { error: "itemIds (array) and isChecked (boolean) are required" },
      { status: 400 }
    );

  // Verify all items belong to a list owned by this household
  const items = await prisma.foodGroceryItem.findMany({
    where: { id: { in: itemIds } },
    include: { list: { select: { householdId: true } } },
  });

  const unauthorized = items.some(
    (i) => i.list.householdId !== household.id
  );
  if (unauthorized)
    return NextResponse.json({ error: "Unauthorized items" }, { status: 403 });

  await prisma.foodGroceryItem.updateMany({
    where: { id: { in: itemIds } },
    data: { isChecked },
  });

  return NextResponse.json({ updated: itemIds.length });
}
