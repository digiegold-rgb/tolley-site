// Food API route
import { NextRequest, NextResponse } from "next/server";
import { getFoodApiUserId } from "@/lib/food/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const userId = await getFoodApiUserId();
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const household = await prisma.foodHousehold.findUnique({
    where: { userId: userId },
  });
  if (!household)
    return NextResponse.json({ error: "No household" }, { status: 404 });

  const location = request.nextUrl.searchParams.get("location");

  const items = await prisma.foodPantryItem.findMany({
    where: {
      householdId: household.id,
      ...(location && { location }),
    },
    orderBy: [
      { expiresAt: { sort: "asc", nulls: "last" } },
      { name: "asc" },
    ],
  });

  return NextResponse.json({ items });
}

export async function POST(request: NextRequest) {
  const userId = await getFoodApiUserId();
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const household = await prisma.foodHousehold.findUnique({
    where: { userId: userId },
  });
  if (!household)
    return NextResponse.json({ error: "No household" }, { status: 404 });

  const body = await request.json();
  const { name, location, quantity, unit, expiresAt, category, autoRestock } =
    body;

  if (!name)
    return NextResponse.json({ error: "name is required" }, { status: 400 });

  const item = await prisma.foodPantryItem.create({
    data: {
      householdId: household.id,
      name,
      location: location || "pantry",
      quantity: quantity ? Number(quantity) : 1,
      unit: unit || null,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      category: category || null,
      autoRestock: autoRestock || false,
    },
  });

  return NextResponse.json({ item }, { status: 201 });
}
