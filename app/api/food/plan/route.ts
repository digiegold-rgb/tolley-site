// @ts-nocheck — references removed Prisma models
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

function getMondayOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const household = await prisma.foodHousehold.findUnique({
    where: { userId: session.user.id },
  });
  if (!household)
    return NextResponse.json({ error: "No household" }, { status: 404 });

  const weekStartParam = request.nextUrl.searchParams.get("weekStart");
  const weekStart = weekStartParam
    ? new Date(weekStartParam)
    : getMondayOfWeek(new Date());

  // When weekStart is provided, return single plan
  if (weekStartParam) {
    const plan = await prisma.foodMealPlan.findFirst({
      where: {
        householdId: household.id,
        weekStart,
      },
      include: { slots: { include: { recipe: true } } },
    });

    return NextResponse.json({ plan: plan || null });
  }

  const plans = await prisma.foodMealPlan.findMany({
    where: { householdId: household.id },
    include: { slots: { include: { recipe: true } } },
    orderBy: { weekStart: "desc" },
  });

  return NextResponse.json({ plans });
}

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
  const { weekStart } = body;

  if (!weekStart)
    return NextResponse.json(
      { error: "weekStart is required" },
      { status: 400 }
    );

  const date = new Date(weekStart);
  if (date.getUTCDay() !== 1)
    return NextResponse.json(
      { error: "weekStart must be a Monday" },
      { status: 400 }
    );

  date.setUTCHours(0, 0, 0, 0);

  const existing = await prisma.foodMealPlan.findUnique({
    where: {
      householdId_weekStart: { householdId: household.id, weekStart: date },
    },
  });
  if (existing)
    return NextResponse.json(
      { error: "Plan already exists for this week" },
      { status: 409 }
    );

  const plan = await prisma.foodMealPlan.create({
    data: {
      householdId: household.id,
      weekStart: date,
    },
    include: { slots: true },
  });

  return NextResponse.json({ plan }, { status: 201 });
}
