// @ts-nocheck — references removed Prisma models
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
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

  const { id: recipeId } = await params;

  const recipe = await prisma.foodRecipe.findFirst({
    where: { id: recipeId, householdId: household.id },
  });
  if (!recipe)
    return NextResponse.json({ error: "Recipe not found" }, { status: 404 });

  const ingredients = recipe.ingredients as Array<{
    name: string;
    quantity?: number;
    unit?: string;
    notes?: string;
  }>;

  const priceEntries = await prisma.foodPriceEntry.findMany({
    where: { householdId: household.id },
    orderBy: { purchaseDate: "desc" },
  });

  let totalCost = 0;
  const ingredientCosts = ingredients.map((ing) => {
    const normalized = ing.name.toLowerCase().trim();
    const match = priceEntries.find(
      (p) =>
        p.normalizedName?.toLowerCase() === normalized ||
        p.itemName.toLowerCase().includes(normalized) ||
        normalized.includes(p.itemName.toLowerCase())
    );
    const price = match?.price ?? 0;
    totalCost += price;
    return {
      name: ing.name,
      price,
      found: !!match,
    };
  });

  const costPerServing = recipe.servings > 0 ? totalCost / recipe.servings : totalCost;

  return NextResponse.json({
    totalCost: Math.round(totalCost * 100) / 100,
    costPerServing: Math.round(costPerServing * 100) / 100,
    ingredients: ingredientCosts,
    currency: "USD",
  });
}
