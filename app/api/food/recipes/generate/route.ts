// @ts-nocheck — references removed Prisma models
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { generateRecipe } from "@/lib/food/ai-recipes";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const household = await prisma.foodHousehold.findUnique({
    where: { userId: session.user.id },
    include: { members: true },
  });
  if (!household)
    return NextResponse.json({ error: "No household" }, { status: 404 });

  const body = await request.json();
  const { cuisine, mealType, dietary, dislikes, servings, pantryItems, quickMeal } = body;

  // Aggregate dietary flags and dislikes from household members
  const allDietary = new Set<string>(dietary || []);
  const allDislikes = new Set<string>(dislikes || []);
  for (const m of household.members) {
    m.dietaryFlags.forEach((f: string) => allDietary.add(f));
    m.dislikes.forEach((d: string) => allDislikes.add(d));
  }

  try {
    const generated = await generateRecipe({
      cuisine,
      mealType,
      dietary: [...allDietary],
      dislikes: [...allDislikes],
      servings: servings || household.defaultServings,
      pantryItems,
      quickMeal,
    });

    // Ensure unique slug
    let slug = generated.slug;
    let counter = 1;
    while (
      await prisma.foodRecipe.findUnique({
        where: { householdId_slug: { householdId: household.id, slug } },
      })
    ) {
      counter++;
      slug = `${generated.slug}-${counter}`;
    }

    const recipe = await prisma.foodRecipe.create({
      data: {
        householdId: household.id,
        title: generated.title,
        slug,
        description: generated.description,
        ingredients: generated.ingredients as any,
        instructions: generated.instructions as any,
        cuisine: generated.cuisine,
        mealType: generated.mealType,
        prepTime: generated.prepTime,
        cookTime: generated.cookTime,
        servings: generated.servings,
        nutrition: generated.nutrition as any,
        tags: generated.tags,
        aiGenerated: true,
        aiPrompt: JSON.stringify(body),
        source: "AI generated",
      },
    });

    return NextResponse.json({ recipe }, { status: 201 });
  } catch (err) {
    console.error("[Food] Recipe generation error:", err);
    return NextResponse.json(
      { error: "Failed to generate recipe" },
      { status: 500 }
    );
  }
}
