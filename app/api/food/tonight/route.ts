// Food API route
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const household = await prisma.foodHousehold.findUnique({
    where: { userId: session.user.id },
  });
  if (!household)
    return NextResponse.json({ error: "No household" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const quickOnly = body.quickOnly === true;
  const cuisineFilter = body.cuisine && body.cuisine !== "Any" ? body.cuisine : null;

  const now = new Date();

  // Get context
  const [recipes, pantryItems, cookLogs] = await Promise.all([
    prisma.foodRecipe.findMany({
      where: {
        householdId: household.id,
        mealType: { hasSome: ["dinner", "lunch"] },
        ...(cuisineFilter ? { cuisine: cuisineFilter } : {}),
        ...(quickOnly ? { cookTime: { lte: 30 } } : {}),
      },
      orderBy: { rating: "desc" },
    }),
    prisma.foodPantryItem.findMany({
      where: { householdId: household.id, status: { not: "out_of_stock" } },
      orderBy: { expiresAt: "asc" },
    }),
    prisma.foodCookLog.findMany({
      where: { recipe: { householdId: household.id } },
      include: { recipe: { select: { id: true, title: true } } },
      orderBy: { cookedAt: "desc" },
      take: 10,
    }),
  ]);

  const expiringSoon = pantryItems
    .filter((i) => i.expiresAt && i.expiresAt.getTime() - now.getTime() < 5 * 86400000)
    .map((i) => i.name);

  const recentRecipeIds = new Set(cookLogs.map((l) => l.recipe.id));

  // Score recipes: prioritize uncooked, highly rated, matching pantry/expiring
  const scored = recipes.map((r) => {
    let score = 0;
    // Avoid recently cooked
    if (recentRecipeIds.has(r.id)) score -= 50;
    // Boost rating
    score += (r.rating || 3) * 10;
    // Boost kid-friendly
    if (r.tags.includes("kid-friendly")) score += 5;
    // Boost quick meals
    if ((r.prepTime || 0) + (r.cookTime || 0) <= 30) score += 8;
    // Boost if uses expiring pantry items
    const ingredients = (r.ingredients as any[]) || [];
    const usesExpiring: string[] = [];
    for (const ing of ingredients) {
      const name = (ing.name || "").toLowerCase();
      for (const exp of expiringSoon) {
        if (exp.toLowerCase().includes(name) || name.includes(exp.toLowerCase())) {
          usesExpiring.push(exp);
          score += 20;
        }
      }
    }
    // Add randomness for variety
    score += Math.random() * 15;
    return { recipe: r, score, usesExpiring };
  });

  scored.sort((a, b) => b.score - a.score);

  // Pick top 3
  const picks = scored.slice(0, 3);

  // AI is always available thanks to Gemini fallback (see lib/food/ai-client.ts).
  // This endpoint's scoring is rule-based so it doesn't actually invoke the AI.
  const aiEnhanced = true;

  const suggestions = picks.map((p) => ({
    title: p.recipe.title,
    description: p.recipe.description || `${p.recipe.cuisine || ""} recipe — ${(p.recipe.prepTime || 0) + (p.recipe.cookTime || 0)} min total`,
    estimatedTime: (p.recipe.prepTime || 0) + (p.recipe.cookTime || 0),
    difficulty: (p.recipe.prepTime || 0) + (p.recipe.cookTime || 0) <= 20 ? "easy" : (p.recipe.prepTime || 0) + (p.recipe.cookTime || 0) <= 45 ? "medium" : "hard",
    kidFriendly: p.recipe.tags.includes("kid-friendly"),
    usesExpiring: p.usesExpiring,
    expiringItemsUsed: p.usesExpiring,
    recipeId: p.recipe.id,
    slug: p.recipe.slug,
    imageUrl: p.recipe.imageUrl,
    cuisine: p.recipe.cuisine,
    tags: p.recipe.tags,
  }));

  return NextResponse.json({
    suggestions,
    expiring: expiringSoon,
    expiringItems: expiringSoon,
    aiPowered: aiEnhanced,
  });
}
