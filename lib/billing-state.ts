import { prisma } from "@/lib/prisma";
import {
  hasPaidAccess,
  normalizePlanTier,
  resolvePlanFromPriceId,
  resolveTierForStatus,
  type PlanTier,
} from "@/lib/subscription";

export type BillingState = {
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  subscriptionStatus: string;
  subscriptionTier: PlanTier;
  currentPeriodEnd: string | null;
};

function createDefaultBillingState(): BillingState {
  return {
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    subscriptionStatus: "none",
    subscriptionTier: "none",
    currentPeriodEnd: null,
  };
}

export async function getUserBillingState(userId: string): Promise<BillingState> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      stripeCustomerId: true,
      stripeSubscriptionId: true,
      subscriptionStatus: true,
      subscriptionTier: true,
      currentPeriodEnd: true,
    },
  });

  if (!user) {
    return createDefaultBillingState();
  }

  let state: BillingState = {
    stripeCustomerId: user.stripeCustomerId,
    stripeSubscriptionId: user.stripeSubscriptionId,
    subscriptionStatus: user.subscriptionStatus || "none",
    subscriptionTier: normalizePlanTier(user.subscriptionTier),
    currentPeriodEnd: user.currentPeriodEnd?.toISOString() || null,
  };

  // Backfill from legacy subscription table if user billing fields are empty.
  if (
    state.subscriptionTier === "none" &&
    !state.stripeCustomerId &&
    !state.stripeSubscriptionId
  ) {
    const legacy = await prisma.subscription.findUnique({
      where: { userId },
      select: {
        stripeCustomerId: true,
        stripeSubscriptionId: true,
        status: true,
        priceId: true,
        currentPeriodEnd: true,
      },
    });

    if (legacy) {
      const legacyTier = resolveTierForStatus(
        legacy.status,
        resolvePlanFromPriceId(legacy.priceId),
      );
      state = {
        stripeCustomerId: legacy.stripeCustomerId,
        stripeSubscriptionId: legacy.stripeSubscriptionId,
        subscriptionStatus: legacy.status || "none",
        subscriptionTier: legacyTier,
        currentPeriodEnd: legacy.currentPeriodEnd?.toISOString() || null,
      };

      await prisma.user
        .update({
          where: { id: userId },
          data: {
            stripeCustomerId: legacy.stripeCustomerId,
            stripeSubscriptionId: legacy.stripeSubscriptionId,
            subscriptionStatus: legacy.status || "none",
            subscriptionTier: legacyTier,
            currentPeriodEnd: legacy.currentPeriodEnd || null,
          },
        })
        .catch(() => {});
    }
  }

  return state;
}

export function isSubscribed(state: BillingState) {
  return hasPaidAccess(state.subscriptionTier, state.subscriptionStatus);
}
