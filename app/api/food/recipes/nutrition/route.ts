import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { estimateNutrition } from "@/lib/food/ai-recipes";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { ingredients } = await request.json();
  if (!ingredients || !Array.isArray(ingredients) || ingredients.length === 0) {
    return NextResponse.json(
      { error: "Provide an ingredients array" },
      { status: 400 }
    );
  }

  try {
    const nutrition = await estimateNutrition(ingredients);
    return NextResponse.json(nutrition);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to estimate";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
