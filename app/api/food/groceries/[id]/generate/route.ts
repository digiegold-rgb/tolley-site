// @ts-nocheck — references removed Prisma models
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { mergeIngredients } from "@/lib/food/grocery-dedup";
import { normalizeIngredient } from "@/lib/food/ingredient-taxonomy";

interface RecipeIngredient {
  name: string;
  quantity: number;
  unit: string;
  notes?: string;
}

export async function POST(
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
    include: { items: true },
  });
  if (!list)
    return NextResponse.json({ error: "List not found" }, { status: 404 });

  if (!list.planId)
    return NextResponse.json(
      { error: "List is not linked to a meal plan" },
      { status: 400 }
    );

  // Fetch all recipes from the linked meal plan
  const slots = await prisma.foodMealSlot.findMany({
    where: { planId: list.planId, recipeId: { not: null } },
    include: { recipe: true },
  });

  // Aggregate ingredients from all recipes
  const allIngredients: RecipeIngredient[] = [];
  for (const slot of slots) {
    if (slot.recipe?.ingredients) {
      const ingredients = slot.recipe.ingredients as unknown as RecipeIngredient[];
      allIngredients.push(...ingredients);
    }
  }

  if (allIngredients.length === 0)
    return NextResponse.json(
      { error: "No recipes with ingredients found in this plan" },
      { status: 400 }
    );

  // Deduplicate and normalize ingredients
  const deduped = mergeIngredients(allIngredients.map((i) => ({ name: i.name, quantity: i.quantity || 1, unit: i.unit || "" })));

  // Fetch pantry items to subtract
  const pantryItems = await prisma.foodPantryItem.findMany({
    where: { householdId: household.id, status: { not: "out_of_stock" } },
  });

  const pantryMap = new Map<string, number>();
  for (const p of pantryItems) {
    const { canonical } = normalizeIngredient(p.name);
    pantryMap.set(canonical, (pantryMap.get(canonical) || 0) + p.quantity);
  }

  // Subtract pantry from needed ingredients
  const needed = deduped.filter((item) => {
    const inPantry = pantryMap.get(item.normalizedName) || 0;
    if (inPantry >= item.quantity) return false;
    item.quantity -= inPantry;
    return true;
  });

  // Clear existing auto-generated items
  await prisma.foodGroceryItem.deleteMany({
    where: { listId: id, addedBy: "meal_plan" },
  });

  // Create grocery items with aisle assignments
  const items = await Promise.all(
    needed.map((item) =>
      prisma.foodGroceryItem.create({
        data: {
          listId: id,
          name: item.name,
          normalizedName: item.normalizedName,
          quantity: item.quantity,
          unit: item.unit || null,
          category: item.category,
          aisle: item.aisle,
          addedBy: "meal_plan",
        },
      })
    )
  );

  return NextResponse.json({ items, count: items.length });
}
