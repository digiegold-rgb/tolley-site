import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isFoodAccessGranted } from "@/lib/food-subscription";

export async function getFoodHousehold() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const household = await prisma.foodHousehold.findUnique({
    where: { userId: session.user.id },
    include: { members: true },
  });

  return household ? { ...household, userId: session.user.id } : null;
}

export async function requireFoodHousehold() {
  const household = await getFoodHousehold();
  if (!household) throw new Error("No household found");
  return household;
}

/**
 * Gate a /food/** page. Redirects appropriately:
 *   - No session → /login
 *   - No household → /food/onboarding
 *   - No active subscription → /food/billing
 *
 * Use at the top of gated server components. Exempt pages (billing, onboarding,
 * landing) should call `requireFoodSession()` instead and handle their own UX.
 */
export async function requireFoodAccess(options: { callbackUrl?: string } = {}) {
  const callbackUrl = options.callbackUrl ?? "/food";
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  }

  const household = await prisma.foodHousehold.findUnique({
    where: { userId: session.user.id },
    include: { members: true },
  });

  if (!household) {
    redirect("/food/onboarding");
  }

  if (!isFoodAccessGranted(household.subscriptionStatus)) {
    redirect("/food/billing");
  }

  return {
    session,
    userId: session.user.id,
    household,
  };
}

/**
 * Lighter guard: requires a logged-in user but does NOT require an active
 * subscription. Use on billing, onboarding, and success pages where the user
 * legitimately needs access before paying.
 */
export async function requireFoodSession(options: { callbackUrl?: string } = {}) {
  const callbackUrl = options.callbackUrl ?? "/food";
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  }

  const household = await prisma.foodHousehold.findUnique({
    where: { userId: session.user.id },
    include: { members: true },
  });

  return {
    session,
    userId: session.user.id,
    household,
  };
}
