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

  const plan = await prisma.foodMealPlan.findFirst({
    where: { id, householdId: household.id },
    include: {
      slots: {
        include: { recipe: true },
        orderBy: [{ day: "asc" }, { mealType: "asc" }],
      },
    },
  });

  if (!plan)
    return NextResponse.json({ error: "Plan not found" }, { status: 404 });

  return NextResponse.json({ plan });
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

  const existing = await prisma.foodMealPlan.findFirst({
    where: { id, householdId: household.id },
  });
  if (!existing)
    return NextResponse.json({ error: "Plan not found" }, { status: 404 });

  const body = await request.json();
  const { status } = body;

  const plan = await prisma.foodMealPlan.update({
    where: { id },
    data: { ...(status !== undefined && { status }) },
  });

  return NextResponse.json({ plan });
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

  const existing = await prisma.foodMealPlan.findFirst({
    where: { id, householdId: household.id },
  });
  if (!existing)
    return NextResponse.json({ error: "Plan not found" }, { status: 404 });

  await prisma.foodMealPlan.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
