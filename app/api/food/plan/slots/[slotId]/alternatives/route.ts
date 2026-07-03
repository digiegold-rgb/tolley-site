import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { chooseReplacement } from "@/lib/food/slot-replacement";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slotId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slotId } = await params;
  const url = new URL(request.url);
  const count = Math.max(1, Math.min(6, Number(url.searchParams.get("count") || "3")));
  const excludeParam = url.searchParams.get("exclude") || "";
  const excludeIds = excludeParam.split(",").map((s) => s.trim()).filter(Boolean);

  const household = await prisma.foodHousehold.findUnique({
    where: { userId: session.user.id },
    include: { members: true },
  });
  if (!household)
    return NextResponse.json({ error: "No household" }, { status: 404 });

  const slot = await prisma.foodMealSlot.findFirst({
    where: { id: slotId, plan: { householdId: household.id } },
    include: { plan: true },
  });
  if (!slot)
    return NextResponse.json({ error: "Slot not found" }, { status: 404 });

  const recipes = await chooseReplacement({
    householdId: household.id,
    planId: slot.planId,
    weekStart: slot.plan.weekStart,
    mealType: slot.mealType,
    currentRecipeId: slot.recipeId,
    members: household.members,
    cuisinePrefs: household.cuisinePreferences || [],
    excludeIds,
    takeN: count,
  });

  const alternatives = recipes.map((r) => {
    const total = (r.prepTime || 0) + (r.cookTime || 0);
    const bits: string[] = [];
    if (r.cuisine) bits.push(r.cuisine);
    if (total > 0) bits.push(`${total} min`);
    if (r.rating) bits.push(`${r.rating.toFixed(1)}★`);
    return {
      id: r.id,
      title: r.title,
      slug: r.slug,
      imageUrl: r.imageUrl,
      cuisine: r.cuisine,
      prepTime: r.prepTime,
      cookTime: r.cookTime,
      rating: r.rating,
      reason: bits.join(" · ") || "Good match",
    };
  });

  return NextResponse.json({ alternatives });
}
