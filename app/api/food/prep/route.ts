// Food API route
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { chatJSON } from "@/lib/food/ai-client";

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
  const { recipeIds, prepDate } = body as {
    recipeIds: string[];
    prepDate: string;
  };

  if (!recipeIds?.length)
    return NextResponse.json(
      { error: "recipeIds is required" },
      { status: 400 }
    );

  const recipes = await prisma.foodRecipe.findMany({
    where: { id: { in: recipeIds }, householdId: household.id },
  });

  if (!recipes.length)
    return NextResponse.json({ error: "No recipes found" }, { status: 404 });

  const recipeSummaries = recipes.map((r) => ({
    title: r.title,
    prepTime: r.prepTime,
    cookTime: r.cookTime,
    servings: r.servings,
    ingredients: r.ingredients,
    instructions: r.instructions,
  }));

  const systemPrompt = `You are a meal prep coordinator. Given these recipes, create an efficient batch cooking timeline for one prep session. Group shared prep tasks (chopping, marinating). Order by cook time (longest first). Return JSON: {timeline: [{time: "9:00 AM", duration: 15, task: string, recipe: string}], totalTime: number, shoppingList: [{name, quantity, unit}], tips: string[]}`;

  const userPrompt = `Prep date: ${prepDate || "today"}

Recipes to prep:
${recipeSummaries.map((r) => `- ${r.title} (prep: ${r.prepTime ?? "?"}min, cook: ${r.cookTime ?? "?"}min, servings: ${r.servings})
  Ingredients: ${JSON.stringify(r.ingredients)}
  Instructions: ${JSON.stringify(r.instructions)}`).join("\n\n")}`;

  try {
    const plan = await chatJSON<Record<string, unknown>>({
      task: "meal-prep-timeline",
      system: systemPrompt,
      user: userPrompt,
      temperature: 0.3,
      maxTokens: 4096,
      timeoutMs: 90000,
    });
    return NextResponse.json(plan);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "AI request failed", detail: message },
      { status: 500 }
    );
  }
}
