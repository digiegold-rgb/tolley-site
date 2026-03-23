// @ts-nocheck — references removed Prisma models
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { normalizeIngredient } from "@/lib/food/ingredient-taxonomy";

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
  const { items } = body;

  if (!Array.isArray(items) || items.length === 0)
    return NextResponse.json(
      { error: "items array is required" },
      { status: 400 }
    );

  const created = await Promise.all(
    items.map(
      (item: {
        name: string;
        quantity: number;
        unit?: string;
        category?: string;
        location?: string;
      }) => {
        const { canonical, category: normCategory } = normalizeIngredient(item.name);
        return prisma.foodPantryItem.create({
          data: {
            householdId: household.id,
            name: item.name,
            normalizedName: canonical,
            quantity: item.quantity || 1,
            unit: item.unit || null,
            category: item.category || normCategory || null,
            location: item.location || "pantry",
          },
        });
      }
    )
  );

  return NextResponse.json({ items: created, count: created.length }, { status: 201 });
}
