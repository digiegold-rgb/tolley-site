import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import Stripe from "stripe";

import { getTierFromPriceId, updateUserBillingState } from "@/lib/billing";
import { prisma } from "@/lib/prisma";
import { getStripeClient } from "@/lib/stripe";
import { resolveTierForStatus } from "@/lib/subscription";
import {
  isLeadsPriceId,
  resolveLeadsTierFromPriceId,
  getLeadsTierLimits,
} from "@/lib/leads-subscription";

export const runtime = "nodejs";

function getCurrentPeriodEnd(subscription: Stripe.Subscription) {
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

  const byUser = await prisma.user.findUnique({
    where: { stripeCustomerId: customerId },
    select: { id: true },
  });
  if (byUser?.id) {
    return byUser.id;
  }

  const byLegacySubscription = await prisma.subscription.findFirst({
    where: { stripeCustomerId: customerId },
    select: { userId: true },
  });
  if (byLegacySubscription?.userId) {
    return byLegacySubscription.userId;
  }

  const customer = await stripe.customers.retrieve(customerId);
  if ("deleted" in customer) {
    return null;
  }

  return customer.metadata?.userId || null;
}

async function syncSubscriptionRecord(
  subscription: Stripe.Subscription,
  preferredUserId?: string | null,
) {
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id;

  const metadataUserId = subscription.metadata?.userId;
  const userId =
    preferredUserId ||
    metadataUserId ||
    (await resolveUserIdFromStripeCustomer(customerId));

  if (!userId) {
    console.warn(
      "webhook subscription sync skipped: unable to resolve user",
      subscription.id,
    );
    return;
  }

  const priceId = subscription.items?.data?.[0]?.price?.id || null;
  const resolvedTier = getTierFromPriceId(priceId);
  const subscriptionTier = resolveTierForStatus(subscription.status, resolvedTier);
  const currentPeriodEndUnix = getCurrentPeriodEnd(subscription);

  await updateUserBillingState({
    userId,
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscription.id,
    subscriptionStatus: subscription.status,
    subscriptionTier,
    priceId,
    currentPeriodEnd: currentPeriodEndUnix
      ? new Date(currentPeriodEndUnix * 1000)
      : null,
  });
}

async function syncFromInvoice(invoice: Stripe.Invoice) {
  const invoiceWithSubscription = invoice as Stripe.Invoice & {
    subscription?: string | Stripe.Subscription | null;
  };
  const subscriptionId =
    typeof invoiceWithSubscription.subscription === "string"
      ? invoiceWithSubscription.subscription
      : invoiceWithSubscription.subscription?.id;

  if (!subscriptionId) {
    return;
  }

  const stripe = getStripeClient();
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  await syncSubscriptionRecord(subscription);
}

async function syncLeadsSubscription(
  subscription: Stripe.Subscription,
  preferredUserId?: string | null
) {
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id;

  const metadataUserId = subscription.metadata?.userId;
  const userId =
    preferredUserId ||
    metadataUserId ||
    (await resolveUserIdFromStripeCustomer(customerId));

  if (!userId) {
    console.warn("webhook leads sub sync skipped: no user", subscription.id);
    return;
  }

  const priceId = subscription.items?.data?.[0]?.price?.id || null;
  const tier = resolveLeadsTierFromPriceId(priceId);
  const limits = getLeadsTierLimits(tier);
  const isActive = ["active", "trialing", "past_due"].includes(subscription.status);

  await prisma.leadSubscriber.upsert({
    where: { userId },
    create: {
      userId,
      tier: tier === "none" ? "starter" : tier,
      stripeSubscriptionId: subscription.id,
      status: isActive ? "active" : subscription.status,
      smsLimit: limits.smsLimit,
      snapLimit: limits.snapLimit,
      maxAgents: limits.maxAgents,
    },
    update: {
      tier: tier === "none" ? undefined : tier,
      stripeSubscriptionId: subscription.id,
      status: isActive ? "active" : subscription.status,
      smsLimit: limits.smsLimit,
      snapLimit: limits.snapLimit,
      maxAgents: limits.maxAgents,
    },
  });

  console.log(`[leads] Synced subscription for user ${userId}: ${tier} (${subscription.status})`);
}

async function syncCheckoutSession(checkoutSession: Stripe.Checkout.Session) {
  const stripe = getStripeClient();
  const userId = checkoutSession.metadata?.userId || null;
  const customerId =
    typeof checkoutSession.customer === "string"
      ? checkoutSession.customer
      : checkoutSession.customer?.id;
  const subscriptionId =
    typeof checkoutSession.subscription === "string"
      ? checkoutSession.subscription
      : checkoutSession.subscription?.id;

  if (subscriptionId) {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    await syncSubscriptionRecord(subscription, userId);
    return;
  }

  if (userId && customerId) {
    await prisma.user.update({
      where: { id: userId },
      data: {
        stripeCustomerId: customerId,
      },
    });
  }
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
    switch (event.type) {
      case "checkout.session.completed": {
        const checkoutSession = event.data.object as Stripe.Checkout.Session;

        // Shop item purchase — mark as sold
        const shopItemId = checkoutSession.metadata?.shopItemId;
        if (shopItemId) {
          await prisma.shopItem.update({
            where: { id: shopItemId },
            data: { status: "sold", soldAt: new Date() },
          });
          revalidatePath("/shop");
          console.log(`[shop] Item ${shopItemId} marked sold via Stripe`);
          break;
        }

        // Leads subscription checkout
        if (checkoutSession.metadata?.product === "leads") {
          const subId =
            typeof checkoutSession.subscription === "string"
              ? checkoutSession.subscription
              : checkoutSession.subscription?.id;
          if (subId) {
            const stripe = getStripeClient();
            const sub = await stripe.subscriptions.retrieve(subId);
            await syncLeadsSubscription(sub, checkoutSession.metadata?.userId);
          }
          break;
        }

        await syncCheckoutSession(checkoutSession);
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const subPriceId = subscription.items?.data?.[0]?.price?.id;
        if (subPriceId && isLeadsPriceId(subPriceId)) {
          await syncLeadsSubscription(subscription);
        } else {
          await syncSubscriptionRecord(subscription);
        }
        break;
      }
      case "invoice.paid":
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        await syncFromInvoice(invoice);
        break;
      }
      default:
        break;
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("stripe webhook processing error", error);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
