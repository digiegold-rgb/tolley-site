// @ts-nocheck — references removed Prisma models
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const CATEGORY_MAP: Record<string, string> = {
  produce: "Fresh Produce",
  dairy: "Dairy & Eggs",
  meat: "Meat & Seafood",
  pantry: "Pantry Staples",
  frozen: "Frozen Foods",
  bakery: "Bakery",
  beverages: "Beverages",
  snacks: "Snacks",
  condiments: "Condiments & Sauces",
  spices: "Spices & Seasonings",
};

function toSearchTerm(name: string): string {
  return name
    .replace(/\b(brand|organic|store-brand|generic)\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const household = await prisma.foodHousehold.findUnique({
    where: { userId: session.user.id },
  });
  if (!household)
    return NextResponse.json({ error: "No household" }, { status: 404 });

  const body = await req.json();
  const { listId } = body as { listId: string };
  if (!listId)
    return NextResponse.json({ error: "listId is required" }, { status: 400 });

  const list = await prisma.foodGroceryList.findFirst({
    where: { id: listId, householdId: household.id },
    include: {
      items: {
        where: { isChecked: false },
        orderBy: { category: "asc" },
      },
    },
  });
  if (!list)
    return NextResponse.json({ error: "List not found" }, { status: 404 });

  const items = list.items.map((item) => ({
    searchTerm: toSearchTerm(item.normalizedName || item.name),
    quantity: item.quantity,
    unit: item.unit || "each",
    category: CATEGORY_MAP[item.category || "pantry"] || "Other",
  }));

  return NextResponse.json({
    items,
    totalItems: items.length,
  });
}
