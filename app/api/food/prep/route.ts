// @ts-nocheck — references removed Prisma models
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const VLLM_URL = process.env.VLLM_URL || "http://127.0.0.1:8355/v1";

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
    const res = await fetch(`${VLLM_URL}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "Qwen/Qwen3.5-35B-A3B-FP8",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 4096,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { error: "vLLM request failed", detail: text },
        { status: 502 }
      );
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || "";
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch)
      return NextResponse.json(
        { error: "Failed to parse AI response", raw: content },
        { status: 500 }
      );

    const plan = JSON.parse(jsonMatch[0]);
    return NextResponse.json(plan);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "AI request failed", detail: message },
      { status: 500 }
    );
  }
}
