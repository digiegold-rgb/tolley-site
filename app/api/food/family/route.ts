// @ts-nocheck — references removed Prisma models
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const household = await prisma.foodHousehold.findUnique({
    where: { userId: session.user.id },
  });
  if (!household)
    return NextResponse.json({ error: "No household" }, { status: 404 });

  const recipes = await prisma.foodRecipe.findMany({
    where: { householdId: household.id },
    include: {
      cookLogs: { select: { rating: true, cookedAt: true } },
    },
  });

  let totalRatingSum = 0;
  let totalRatingCount = 0;
  let kidFriendlyTotal = 0;
  let kidFriendlyGood = 0;

  const cuisineMap = new Map<string, { sum: number; count: number }>();
  const recipeStats: Array<{
    title: string;
    rating: number;
    timesCooked: number;
  }> = [];
  const dislikedSet = new Set<string>();

  for (const recipe of recipes) {
    const logs = recipe.cookLogs;
    if (!logs.length) continue;

    const avgRating = logs.reduce((s, l) => s + l.rating, 0) / logs.length;
    totalRatingSum += logs.reduce((s, l) => s + l.rating, 0);
    totalRatingCount += logs.length;

    recipeStats.push({
      title: recipe.title,
      rating: Math.round(avgRating * 10) / 10,
      timesCooked: logs.length,
    });

    if (recipe.cuisine) {
      const existing = cuisineMap.get(recipe.cuisine) || { sum: 0, count: 0 };
      existing.sum += logs.reduce((s, l) => s + l.rating, 0);
      existing.count += logs.length;
      cuisineMap.set(recipe.cuisine, existing);
    }

    if (recipe.tags.includes("kid-friendly")) {
      kidFriendlyTotal++;
      if (avgRating >= 3.5) kidFriendlyGood++;
    }

    if (avgRating < 2.5) {
      if (recipe.cuisine) dislikedSet.add(`${recipe.cuisine} cuisine`);
      for (const tag of recipe.tags) dislikedSet.add(tag);
    }
  }

  const topCuisines = Array.from(cuisineMap.entries())
    .map(([cuisine, { sum, count }]) => ({
      cuisine,
      avgRating: Math.round((sum / count) * 10) / 10,
      count,
    }))
    .sort((a, b) => b.avgRating - a.avgRating);

  const topRecipes = recipeStats
    .sort((a, b) => b.rating - a.rating || b.timesCooked - a.timesCooked)
    .slice(0, 10);

  return NextResponse.json({
    topCuisines,
    topRecipes,
    avoidPatterns: Array.from(dislikedSet),
    totalMealsCooked: totalRatingCount,
    avgRating:
      totalRatingCount > 0
        ? Math.round((totalRatingSum / totalRatingCount) * 10) / 10
        : 0,
    kidFriendlySuccessRate:
      kidFriendlyTotal > 0
        ? Math.round((kidFriendlyGood / kidFriendlyTotal) * 100)
        : null,
  });
}
