// @ts-nocheck — references removed Prisma models
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const household = await prisma.foodHousehold.findUnique({
    where: { userId: session.user.id },
    include: { members: true },
  });

  if (!household)
    return NextResponse.json({ error: "No household" }, { status: 404 });

  return NextResponse.json({ household });
}

export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const existing = await prisma.foodHousehold.findUnique({
    where: { userId: session.user.id },
  });
  if (!existing)
    return NextResponse.json({ error: "No household" }, { status: 404 });

  const body = await request.json();
  const data: Record<string, unknown> = {};
  if (body.name !== undefined) data.name = body.name;
  if (body.timezone !== undefined) data.timezone = body.timezone;
  if (body.weeklyBudget !== undefined)
    data.weeklyBudget = body.weeklyBudget ? Number(body.weeklyBudget) : null;
  if (body.defaultServings !== undefined)
    data.defaultServings = body.defaultServings
      ? Number(body.defaultServings)
      : 4;

  const household = await prisma.foodHousehold.update({
    where: { id: existing.id },
    data,
    include: { members: true },
  });

  return NextResponse.json({ household });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const existing = await prisma.foodHousehold.findUnique({
    where: { userId: session.user.id },
  });
  if (existing)
    return NextResponse.json(
      { error: "Household already exists" },
      { status: 409 }
    );

  const body = await request.json();
  const { name, timezone, weeklyBudget, defaultServings } = body;

  const household = await prisma.foodHousehold.create({
    data: {
      userId: session.user.id,
      name: name || "My Kitchen",
      timezone: timezone || "America/Chicago",
      weeklyBudget: weeklyBudget ? Number(weeklyBudget) : null,
      defaultServings: defaultServings ? Number(defaultServings) : 4,
    },
    include: { members: true },
  });

  return NextResponse.json({ household }, { status: 201 });
}
