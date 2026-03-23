// @ts-nocheck — references removed Prisma models
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { normalizeIngredient } from "@/lib/food/ingredient-taxonomy";

// GET: Return all out-of-stock + low items as a restock list
export async function GET() {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const household = await prisma.foodHousehold.findUnique({
    where: { userId: session.user.id },
  });
  if (!household)
    return NextResponse.json({ error: "No household" }, { status: 404 });

  const items = await prisma.foodPantryItem.findMany({
    where: {
      householdId: household.id,
      status: { in: ["out_of_stock", "low"] },
    },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json({ items, count: items.length });
}

// POST: Mark item as "out" and add to grocery list
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const household = await prisma.foodHousehold.findUnique({
    where: { userId: session.user.id },
  });
  if (!household)
    return NextResponse.json({ error: "No household" }, { status: 404 });

  const { itemId, itemName } = await request.json();

  // Mark pantry item as out_of_stock if itemId provided
  if (itemId) {
    await prisma.foodPantryItem.update({
      where: { id: itemId },
      data: { status: "out_of_stock", quantity: 0 },
    });
  }

  const name = itemName || (itemId ? (await prisma.foodPantryItem.findUnique({ where: { id: itemId } }))?.name : null);
  if (!name) return NextResponse.json({ error: "No item name" }, { status: 400 });

  // Find or create an active "Restock" grocery list
  let restockList = await prisma.foodGroceryList.findFirst({
    where: { householdId: household.id, store: "Restock List", status: "active" },
  });

  if (!restockList) {
    restockList = await prisma.foodGroceryList.create({
      data: { householdId: household.id, store: "Restock List", status: "active" },
    });
  }

  // Check if item already on the list
  const existing = await prisma.foodGroceryItem.findFirst({
    where: { listId: restockList.id, name: { equals: name, mode: "insensitive" } },
  });

  if (!existing) {
    const { canonical, category, aisle } = normalizeIngredient(name);
    await prisma.foodGroceryItem.create({
      data: {
        listId: restockList.id,
        name,
        normalizedName: canonical,
        quantity: 1,
        category,
        aisle,
        addedBy: "restock",
      },
    });
  }

  return NextResponse.json({ success: true, listId: restockList.id });
}
