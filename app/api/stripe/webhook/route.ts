import { NextResponse } from "next/server";
import Stripe from "stripe";

import { prisma } from "@/lib/prisma";
import { getStripeClient } from "@/lib/stripe";
export const runtime = "nodejs";

function getCurrentPeriodEndUnix(subscription: Stripe.Subscription) {
  const fromRoot = (subscription as unknown as { current_period_end?: number })
    .current_period_end;
  if (typeof fromRoot === "number") {
    return fromRoot;
  }

  const fromItems = subscription.items?.data?.[0]?.current_period_end;
  if (typeof fromItems === "number") {
    return fromItems;
  }

  return null;
}

async function resolveUserIdFromStripeCustomer(customerId: string) {
  const stripe = getStripeClient();

  const bySubscription = await prisma.subscription.findFirst({
    where: {
      stripeCustomerId: customerId,
    },
    select: {
      userId: true,
    },
  });

  if (bySubscription?.userId) {
    return bySubscription.userId;
  }

  const customer = await stripe.customers.retrieve(customerId);
  if ("deleted" in customer) {
    return null;
  }

  const metadataUserId = customer.metadata?.userId;
  if (metadataUserId) {
    return metadataUserId;
  }

  return null;
}

async function syncSubscription(subscription: Stripe.Subscription) {
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id;

  const metadataUserId = subscription.metadata?.userId;
  const userId = metadataUserId || (await resolveUserIdFromStripeCustomer(customerId));

  if (!userId) {
    console.warn(
      "webhook subscription sync skipped: unable to resolve user",
      subscription.id,
    );
    return;
  }

  const currentPeriodEndUnix = getCurrentPeriodEndUnix(subscription);
  const priceId = subscription.items?.data?.[0]?.price?.id || null;

  await prisma.subscription.upsert({
    where: {
      userId,
    },
    create: {
      userId,
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscription.id,
      status: subscription.status,
      priceId,
      currentPeriodEnd: currentPeriodEndUnix
        ? new Date(currentPeriodEndUnix * 1000)
        : null,
    },
    update: {
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscription.id,
      status: subscription.status,
      priceId,
      currentPeriodEnd: currentPeriodEndUnix
        ? new Date(currentPeriodEndUnix * 1000)
        : null,
    },
  });
}

export async function POST(request: Request) {
  const stripe = getStripeClient();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json(
      { error: "Webhook secret not configured" },
      { status: 500 },
    );
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const payload = await request.text();
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  } catch (error) {
    console.error("stripe webhook signature error", error);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    if (event.type === "checkout.session.completed") {
      const checkoutSession = event.data.object as Stripe.Checkout.Session;
      const userId = checkoutSession.metadata?.userId;
      const stripeCustomerId =
        typeof checkoutSession.customer === "string"
          ? checkoutSession.customer
          : checkoutSession.customer?.id;
      const stripeSubscriptionId =
        typeof checkoutSession.subscription === "string"
          ? checkoutSession.subscription
          : checkoutSession.subscription?.id;

      if (userId) {
        await prisma.subscription.upsert({
          where: {
            userId,
          },
          create: {
            userId,
            stripeCustomerId,
            stripeSubscriptionId,
            status: "active",
            priceId:
              checkoutSession.line_items?.data?.[0]?.price?.id ||
              checkoutSession.metadata?.priceId ||
              null,
          },
          update: {
            stripeCustomerId,
            stripeSubscriptionId,
            status: "active",
            priceId:
              checkoutSession.line_items?.data?.[0]?.price?.id ||
              checkoutSession.metadata?.priceId ||
              undefined,
          },
        });
      }
    }

    if (
      event.type === "customer.subscription.created" ||
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted"
    ) {
      const subscription = event.data.object as Stripe.Subscription;
      await syncSubscription(subscription);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("stripe webhook processing error", error);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
