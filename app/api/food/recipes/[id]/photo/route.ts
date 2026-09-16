// Food API route
import { NextRequest, NextResponse } from "next/server";
import { getFoodApiUserId } from "@/lib/food/auth";
import { prisma } from "@/lib/prisma";
import { put } from "@vercel/blob";

const MAX_SIZE = 10 * 1024 * 1024; // 10MB

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getFoodApiUserId();
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const household = await prisma.foodHousehold.findUnique({
    where: { userId: userId },
  });
  if (!household)
    return NextResponse.json({ error: "No household" }, { status: 404 });

  const { id: recipeId } = await params;

  const recipe = await prisma.foodRecipe.findFirst({
    where: { id: recipeId, householdId: household.id },
  });
  if (!recipe)
    return NextResponse.json({ error: "Recipe not found" }, { status: 404 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file)
    return NextResponse.json({ error: "No file provided" }, { status: 400 });

  if (!file.type.startsWith("image/"))
    return NextResponse.json({ error: "File must be an image" }, { status: 400 });

  if (file.size > MAX_SIZE)
    return NextResponse.json({ error: "File exceeds 10MB limit" }, { status: 400 });

  const blob = await put(
    `food/dishes/${recipeId}/${Date.now()}-${file.name}`,
    file,
    { access: "public" }
  );

  await prisma.foodRecipe.update({
    where: { id: recipeId },
    data: { imageUrl: blob.url },
  });

  return NextResponse.json({ imageUrl: blob.url });
}
