// @ts-nocheck — references removed Prisma models
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { suggestFromPantry } from "@/lib/food/ai-suggestions";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const household = await prisma.foodHousehold.findUnique({
    where: { userId: session.user.id },
    include: { members: true },
  });
  if (!household)
    return NextResponse.json({ error: "No household" }, { status: 404 });

  // Fetch pantry items
  const pantryItems = await prisma.foodPantryItem.findMany({
    where: { householdId: household.id, status: { not: "out_of_stock" } },
  });

  // Aggregate dietary flags and dislikes
  const allDietary: string[] = [];
  const allDislikes: string[] = [];
  for (const m of household.members) {
    allDietary.push(...m.dietaryFlags);
    allDislikes.push(...m.dislikes);
  }

  // Fetch recent cook logs to avoid repetition
  const recentLogs = await prisma.foodCookLog.findMany({
    where: {
      recipe: { householdId: household.id },
    },
    include: { recipe: { select: { title: true } } },
    orderBy: { cookedAt: "desc" },
    take: 10,
  });
  const recentRecipes = recentLogs.map((l) => l.recipe.title);

  try {
    const suggestions = await suggestFromPantry({
      pantryItems: pantryItems.map((p) => ({
        name: p.name,
        quantity: p.quantity,
        expiresAt: p.expiresAt || undefined,
      })),
      dietary: [...new Set(allDietary)],
      dislikes: [...new Set(allDislikes)],
      recentRecipes,
      servings: household.defaultServings,
    });

    return NextResponse.json({ suggestions });
  } catch (err) {
    console.error("[Food] Suggestion error:", err);
    return NextResponse.json(
      { error: "Failed to generate suggestions" },
      { status: 500 }
    );
  }
}
