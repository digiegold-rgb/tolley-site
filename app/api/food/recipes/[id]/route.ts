// @ts-nocheck — references removed Prisma models
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const household = await prisma.foodHousehold.findUnique({
    where: { userId: session.user.id },
  });
  if (!household)
    return NextResponse.json({ error: "No household" }, { status: 404 });

  const { id } = await params;

  let recipe = await prisma.foodRecipe.findFirst({
    where: { id, householdId: household.id },
    include: {
      cookLogs: { orderBy: { cookedAt: "desc" }, take: 20 },
    },
  });

  // Fallback: try slug lookup
  if (!recipe) {
    recipe = await prisma.foodRecipe.findFirst({
      where: { slug: id, householdId: household.id },
      include: {
        cookLogs: { orderBy: { cookedAt: "desc" }, take: 20 },
      },
    });
  }

  if (!recipe)
    return NextResponse.json({ error: "Recipe not found" }, { status: 404 });

  return NextResponse.json(recipe);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const household = await prisma.foodHousehold.findUnique({
    where: { userId: session.user.id },
  });
  if (!household)
    return NextResponse.json({ error: "No household" }, { status: 404 });

  const { id } = await params;

  const existing = await prisma.foodRecipe.findFirst({
    where: { id, householdId: household.id },
  });
  if (!existing)
    return NextResponse.json({ error: "Recipe not found" }, { status: 404 });

  const body = await request.json();

  // Handle cook log creation
  if (body.incrementCook) {
    // Create cook log
    await prisma.foodCookLog.create({
      data: {
        recipeId: id,
        rating: body.cookRating || body.rating || 3,
        notes: body.cookNotes || null,
      },
    });

    // Get average rating from all cook logs
    const avgResult = await prisma.foodCookLog.aggregate({
      where: { recipeId: id },
      _avg: { rating: true },
    });

    const recipe = await prisma.foodRecipe.update({
      where: { id },
      data: {
        timesCooked: { increment: 1 },
        rating: avgResult._avg.rating || existing.rating || 3,
      },
      include: {
        cookLogs: { orderBy: { cookedAt: "desc" }, take: 20 },
      },
    });

    return NextResponse.json(recipe);
  }

  const allowed = [
    "title",
    "description",
    "ingredients",
    "instructions",
    "cuisine",
    "mealType",
    "prepTime",
    "cookTime",
    "servings",
    "nutrition",
    "tags",
    "imageUrl",
    "rating",
    "source",
  ];

  const data: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) data[key] = body[key];
  }

  const recipe = await prisma.foodRecipe.update({
    where: { id },
    data,
  });

  return NextResponse.json({ recipe });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const household = await prisma.foodHousehold.findUnique({
    where: { userId: session.user.id },
  });
  if (!household)
    return NextResponse.json({ error: "No household" }, { status: 404 });

  const { id } = await params;

  const existing = await prisma.foodRecipe.findFirst({
    where: { id, householdId: household.id },
  });
  if (!existing)
    return NextResponse.json({ error: "Recipe not found" }, { status: 404 });

  await prisma.foodRecipe.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
