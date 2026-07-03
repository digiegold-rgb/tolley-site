import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isFoodAccessGranted } from "@/lib/food-subscription";
import { FoodBillingClient } from "@/components/food/food-billing-client";
import { trackFoodEvent } from "@/lib/food/track";

type BillingPageProps = {
  searchParams?: Promise<{ canceled?: string }>;
};

export default async function FoodBillingPage({ searchParams }: BillingPageProps) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/food/billing");
  }

  const params = (await searchParams) || {};
  const checkoutCanceled = params.canceled === "1";

  const household = await prisma.foodHousehold.findUnique({
    where: { userId: session.user.id },
  });

  const hasAccess = isFoodAccessGranted(household?.subscriptionStatus);
  const trialEndsAt = household?.trialEndsAt ?? null;
  const currentPeriodEnd = household?.currentPeriodEnd ?? null;
  const cancelAtPeriodEnd = household?.cancelAtPeriodEnd ?? false;
  const hasStripeCustomer = Boolean(household?.stripeCustomerId);

  if (household && !hasAccess) {
    void trackFoodEvent(household.id, "paywall_seen", {
      status: household.subscriptionStatus,
      checkoutCanceled,
    });
  }

  return (
    <div
      style={{
        maxWidth: 640,
        margin: "0 auto",
        padding: "3rem 1.5rem",
      }}
    >
      <FoodBillingClient
        hasAccess={hasAccess}
        status={household?.subscriptionStatus ?? "none"}
        trialEndsAt={trialEndsAt ? trialEndsAt.toISOString() : null}
        currentPeriodEnd={
          currentPeriodEnd ? currentPeriodEnd.toISOString() : null
        }
        cancelAtPeriodEnd={cancelAtPeriodEnd}
        hasStripeCustomer={hasStripeCustomer}
        checkoutCanceled={checkoutCanceled}
      />
    </div>
  );
}
