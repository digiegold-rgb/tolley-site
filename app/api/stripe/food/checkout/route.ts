/**
 * POST /api/stripe/food/checkout
 *
 * Creates a Stripe Checkout Session for Ruthann's Kitchen ($39/yr, 30-day trial).
 * Requires a logged-in user. Creates the FoodHousehold shell if missing so the
 * Stripe customer can be linked back via metadata on return.
 *
 * Response: { url }  — client redirects to Stripe-hosted checkout
 */

import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getStripeClient } from "@/lib/stripe";
import {
  FOOD_PRODUCT_METADATA,
  FOOD_TRIAL_DAYS,
  getFoodPriceId,
} from "@/lib/food-subscription";
import { trackFoodEvent } from "@/lib/food/track";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const email = session.user.email;

  const stripe = getStripeClient();
  const priceId = getFoodPriceId();

  // Ensure a FoodHousehold exists so the webhook can attach the subscription.
  const household = await prisma.foodHousehold.upsert({
    where: { userId },
    create: { userId, name: session.user.name ? `${session.user.name}'s Kitchen` : "My Kitchen" },
    update: {},
  });

  // If they already have an active or trialing subscription, send them to /food.
  if (
    household.subscriptionStatus === "active" ||
    household.subscriptionStatus === "trialing"
  ) {
    return NextResponse.json({ url: "/food" });
  }

  // Reuse an existing Stripe customer if we've seen one before.
  let customerId = household.stripeCustomerId || undefined;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email,
      metadata: {
        userId,
        householdId: household.id,
        product: FOOD_PRODUCT_METADATA,
      },
    });
    customerId = customer.id;
    await prisma.foodHousehold.update({
      where: { id: household.id },
      data: { stripeCustomerId: customerId },
    });
  }

  const origin = new URL(request.url).origin;

  const checkout = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    subscription_data: {
      trial_period_days: FOOD_TRIAL_DAYS,
      metadata: {
        userId,
        householdId: household.id,
        product: FOOD_PRODUCT_METADATA,
      },
    },
    payment_method_collection: "always",
    allow_promotion_codes: true,
    success_url: `${origin}/food?welcome=1&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/food/billing?canceled=1`,
    metadata: {
      userId,
      householdId: household.id,
      product: FOOD_PRODUCT_METADATA,
    },
  });

  if (!checkout.url) {
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }

  void trackFoodEvent(household.id, "checkout_started", {
    sessionId: checkout.id,
  });

  return NextResponse.json({ url: checkout.url });
}
