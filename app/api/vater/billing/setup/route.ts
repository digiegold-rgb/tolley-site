/**
 * POST /api/vater/billing/setup
 *
 * Card-on-file capture for pay-per-video billing. Creates a Stripe Checkout
 * Session in mode:"setup" — no subscription object, no charge. The webhook
 * (checkout.session.completed, mode=setup, metadata.product="vater") attaches
 * the payment method as the customer default and flips VaterSubscription to
 * "active" (= card on file).
 *
 * Response: { url } — client redirects to Stripe-hosted checkout.
 */

import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getStripeClient } from "@/lib/stripe";
import { VATER_PRODUCT_METADATA } from "@/lib/vater-subscription";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const email = session.user.email;
  const stripe = getStripeClient();

  // Ensure a VaterSubscription shell exists so the webhook can attach it.
  const sub = await prisma.vaterSubscription.upsert({
    where: { userId },
    create: { userId, status: "trialing" },
    update: {},
  });

  // Reuse Stripe customer if we've seen one (e.g. carry-over from Food).
  let customerId = sub.stripeCustomerId || undefined;
  if (!customerId) {
    const food = await prisma.foodHousehold.findUnique({ where: { userId } });
    if (food?.stripeCustomerId) {
      customerId = food.stripeCustomerId;
    } else {
      const customer = await stripe.customers.create({
        email,
        metadata: { userId, product: VATER_PRODUCT_METADATA },
      });
      customerId = customer.id;
    }
    await prisma.vaterSubscription.update({
      where: { userId },
      data: { stripeCustomerId: customerId },
    });
  }

  const origin = new URL(request.url).origin;

  const checkout = await stripe.checkout.sessions.create({
    mode: "setup",
    customer: customerId,
    payment_method_types: ["card"],
    success_url: `${origin}/animate?card_added=1&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/animate?screen=pricing`,
    metadata: {
      userId,
      product: VATER_PRODUCT_METADATA,
    },
  });

  if (!checkout.url) {
    return NextResponse.json(
      { error: "Failed to create setup session" },
      { status: 500 },
    );
  }

  return NextResponse.json({ url: checkout.url });
}
