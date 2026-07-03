import { prisma } from "@/lib/prisma";

/**
 * Lightweight funnel telemetry for Ruthann's Kitchen. Fire-and-forget — never
 * throws. Each call records one row in FoodActivityEvent and bumps the
 * household's lastActiveAt so the re-engagement cron knows when they last
 * touched the product.
 */
export type FoodEventKind =
  | "wizard_step_complete"
  | "recipe_created"
  | "recipe_imported"
  | "cook_logged"
  | "meal_plan_generated"
  | "chat_used"
  | "paywall_seen"
  | "checkout_started";

export async function trackFoodEvent(
  householdId: string,
  kind: FoodEventKind,
  meta?: Record<string, unknown>,
): Promise<void> {
  if (!householdId) return;
  try {
    await prisma.$transaction([
      prisma.foodActivityEvent.create({
        data: {
          householdId,
          kind,
          meta: meta ? (meta as object) : undefined,
        },
      }),
      prisma.foodHousehold.update({
        where: { id: householdId },
        data: { lastActiveAt: new Date() },
      }),
    ]);
  } catch (err) {
    console.warn(
      `[food-track] failed`,
      JSON.stringify({
        householdId,
        kind,
        error: err instanceof Error ? err.message : String(err),
      }),
    );
  }
}
