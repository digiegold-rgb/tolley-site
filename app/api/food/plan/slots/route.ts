// @ts-nocheck — references removed Prisma models
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const household = await prisma.foodHousehold.findUnique({
    where: { userId: session.user.id },
  });
  if (!household)
    return NextResponse.json({ error: "No household" }, { status: 404 });

  const body = await request.json();
  const { planId, day, mealType, recipeId, customMeal } = body;

  if (!planId || day === undefined || !mealType)
    return NextResponse.json(
      { error: "planId, day, and mealType are required" },
      { status: 400 }
    );

  // Verify plan ownership
  const plan = await prisma.foodMealPlan.findFirst({
    where: { id: planId, householdId: household.id },
  });
  if (!plan)
    return NextResponse.json({ error: "Plan not found" }, { status: 404 });

  // Upsert by planId+day+mealType
  const existing = await prisma.foodMealSlot.findFirst({
    where: { planId, day: Number(day), mealType },
  });

  let slot;
  if (existing) {
    slot = await prisma.foodMealSlot.update({
      where: { id: existing.id },
      data: {
        recipeId: recipeId || null,
        customMeal: customMeal || null,
      },
      include: { recipe: true },
    });
  } else {
    slot = await prisma.foodMealSlot.create({
      data: {
        planId,
        day: Number(day),
        mealType,
        recipeId: recipeId || null,
        customMeal: customMeal || null,
      },
      include: { recipe: true },
    });
  }

  return NextResponse.json({ slot }, { status: existing ? 200 : 201 });
}

export async function DELETE(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const household = await prisma.foodHousehold.findUnique({
    where: { userId: session.user.id },
  });
  if (!household)
    return NextResponse.json({ error: "No household" }, { status: 404 });

  // Accept slotId from body or query param
  let slotId = request.nextUrl.searchParams.get("slotId");
  if (!slotId) {
    try {
      const body = await request.json();
      slotId = body.slotId;
    } catch {
      // no body
    }
  }

  if (!slotId)
    return NextResponse.json({ error: "slotId is required" }, { status: 400 });

  // Verify slot belongs to user's household
  const existing = await prisma.foodMealSlot.findFirst({
    where: { id: slotId, plan: { householdId: household.id } },
  });
  if (!existing)
    return NextResponse.json({ error: "Slot not found" }, { status: 404 });

  await prisma.foodMealSlot.delete({ where: { id: slotId } });

  return NextResponse.json({ ok: true });
}

export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const household = await prisma.foodHousehold.findUnique({
    where: { userId: session.user.id },
  });
  if (!household)
    return NextResponse.json({ error: "No household" }, { status: 404 });

  const body = await request.json();
  const { slotId, recipeId, customMeal, notes } = body;

  if (!slotId)
    return NextResponse.json({ error: "slotId is required" }, { status: 400 });

  // Verify slot belongs to user's household
  const existing = await prisma.foodMealSlot.findFirst({
    where: { id: slotId, plan: { householdId: household.id } },
  });
  if (!existing)
    return NextResponse.json({ error: "Slot not found" }, { status: 404 });

  const slot = await prisma.foodMealSlot.update({
    where: { id: slotId },
    data: {
      ...(recipeId !== undefined && { recipeId: recipeId || null }),
      ...(customMeal !== undefined && { customMeal: customMeal || null }),
      ...(notes !== undefined && { notes: notes || null }),
    },
    include: { recipe: true },
  });

  return NextResponse.json({ slot });
}
