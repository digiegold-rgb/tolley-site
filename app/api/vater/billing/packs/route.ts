/**
 * POST /api/vater/billing/packs  { pack: 10 | 25 | 50 | 100 }
 *
 * Buy prepaid Jelly credits. Stripe Checkout in mode:"payment" — a one-off
 * charge, NOT a subscription. There are no subscriptions in this product.
 *
 * The pack price is a round number and the credit granted is the NET of
 * Stripe's fee ($10 buys $9.41 of credit), stated on the button and on the
 * Stripe line item so nobody discovers it after paying. See
 * lib/vater/billing/ledger.ts for why round-and-transparent beat grossed-up
 * prices like $10.61.
 *
 * `setup_future_usage: "off_session"` saves the card while it is being
 * charged, so a customer who tops up never has to re-enter it — the same
 * thing the SetupIntent route does, for free, on a payment they were already
 * making.
 *
 * Credit is granted by the WEBHOOK (checkout.session.completed →
 * recordPurchase), never here: this route only knows the customer clicked
 * buy, and money that has not settled must not spend.
 */

import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getStripeClient } from "@/lib/stripe";
import { VATER_PRODUCT_METADATA } from "@/lib/vater-subscription";
import { STUDIO_HOME } from "@/lib/vater/product";
import {
  CREDIT_PACKS,
  isCreditPack,
  JELLY_CREDITS_PRODUCT,
  packCreditsCents,
} from "@/lib/vater/billing/ledger";

export const runtime = "nodejs";

export async function GET() {
  // The Billing screen renders its buttons from this, so the net-credit
  // figures can never drift from what the checkout actually grants.
  return NextResponse.json({
    packs: CREDIT_PACKS.map((pack) => ({
      pack,
      priceCents: pack * 100,
      creditsCents: packCreditsCents(pack),
    })),
  });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;
  const email = session.user.email;

  const body = (await request.json().catch(() => ({}))) as { pack?: unknown; returnTo?: unknown };
  if (!isCreditPack(body.pack)) {
    return NextResponse.json(
      { error: `pack must be one of ${CREDIT_PACKS.join(", ")}` },
      { status: 400 },
    );
  }
  const pack = Number(body.pack);
  const creditsCents = packCreditsCents(pack);
  // Which front door Stripe sends the customer back to. Allowlisted to the
  // studio homes (lib/vater/product.ts) — Listing Studio passes
  // "/realestateanimated"; anything else lands on /animate as before.
  const returnTo =
    typeof body.returnTo === "string" && Object.values(STUDIO_HOME).includes(body.returnTo)
      ? body.returnTo
      : STUDIO_HOME.jelly;

  const stripe = getStripeClient();

  // Reuse the Stripe customer the card-on-file flow already created, so a
  // customer does not end up with two Stripe identities.
  const sub = await prisma.vaterSubscription.upsert({
    where: { userId },
    create: { userId, status: "trialing" },
    update: {},
  });
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
  const creditsLabel = `$${(creditsCents / 100).toFixed(2)}`;

  const checkout = await stripe.checkout.sessions.create({
    mode: "payment",
    customer: customerId,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: pack * 100,
          product_data: {
            name: `Jelly Studio — $${pack} credit pack`,
            description: `Adds ${creditsLabel} of render credit (the difference is Stripe's processing fee). No subscription; credit does not expire.`,
          },
        },
      },
    ],
    payment_intent_data: {
      // Save the card on the way past — a top-up should be one click.
      setup_future_usage: "off_session",
      metadata: {
        product: JELLY_CREDITS_PRODUCT,
        userId,
        pack: String(pack),
        creditsCents: String(creditsCents),
      },
    },
    // The /animate shell is a hash router — without #r=pricing Stripe drops
    // the customer on the Dashboard with no sign the credit landed.
    success_url: `${origin}${returnTo}?credits=ok&session_id={CHECKOUT_SESSION_ID}#r=pricing`,
    cancel_url: `${origin}${returnTo}?credits=cancelled#r=pricing`,
    metadata: {
      product: JELLY_CREDITS_PRODUCT,
      userId,
      pack: String(pack),
      creditsCents: String(creditsCents),
    },
  });

  if (!checkout.url) {
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 },
    );
  }
  return NextResponse.json({ url: checkout.url, pack, creditsCents });
}
