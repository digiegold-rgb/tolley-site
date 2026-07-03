import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { trackFoodEvent, type FoodEventKind } from "@/lib/food/track";

const ALLOWED_KINDS: FoodEventKind[] = [
  "wizard_step_complete",
  "recipe_created",
  "recipe_imported",
  "cook_logged",
  "meal_plan_generated",
  "chat_used",
  "paywall_seen",
  "checkout_started",
];

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const kind = body.kind as string | undefined;
  const meta = body.meta as Record<string, unknown> | undefined;

  if (!kind || !ALLOWED_KINDS.includes(kind as FoodEventKind)) {
    return NextResponse.json({ error: "Invalid kind" }, { status: 400 });
  }

  const household = await prisma.foodHousehold.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (!household) {
    return NextResponse.json({ ok: true, skipped: "no-household" });
  }

  void trackFoodEvent(household.id, kind as FoodEventKind, meta);
  return NextResponse.json({ ok: true });
}
