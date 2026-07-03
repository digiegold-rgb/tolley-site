import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { chooseReplacement } from "@/lib/food/slot-replacement";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slotId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slotId } = await params;
  const body = await request.json().catch(() => ({}));
  const excludeIds: string[] = Array.isArray(body.exclude) ? body.exclude : [];

  const household = await prisma.foodHousehold.findUnique({
    where: { userId: session.user.id },
    include: { members: true },
  });
  if (!household)
    return NextResponse.json({ error: "No household" }, { status: 404 });

  const slot = await prisma.foodMealSlot.findFirst({
    where: { id: slotId, plan: { householdId: household.id } },
    include: { plan: true, recipe: true },
  });
  if (!slot)
    return NextResponse.json({ error: "Slot not found" }, { status: 404 });

  const replacement = await chooseReplacement({
    householdId: household.id,
    planId: slot.planId,
    weekStart: slot.plan.weekStart,
    mealType: slot.mealType,
    currentRecipeId: slot.recipeId,
    members: household.members,
    cuisinePrefs: household.cuisinePreferences || [],
    excludeIds,
    takeN: 1,
  });

  if (replacement.length === 0) {
    return NextResponse.json(
      { error: "No suitable replacement found. Try adding more recipes." },
      { status: 404 }
    );
  }

  const next = replacement[0];
  const updated = await prisma.foodMealSlot.update({
    where: { id: slotId },
    data: { recipeId: next.id, customMeal: null },
    include: {
      recipe: {
        select: {
          id: true, title: true, slug: true, imageUrl: true, cuisine: true,
          tags: true, prepTime: true, cookTime: true,
        },
      },
    },
  });

  return NextResponse.json({
    slot: updated,
    previous: slot.recipe ? { id: slot.recipe.id, title: slot.recipe.title } : null,
  });
}
