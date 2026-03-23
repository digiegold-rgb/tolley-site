/**
 * lib/stripe-webhook.ts
 *
 * Business logic for Stripe webhook event processing.
 * Extracted from app/api/stripe/webhook/route.ts — route is now a thin
 * signature-verifier + event dispatcher.
 */

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
import { SUBSCRIPTION_PLANS } from "@/lib/video";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

export function getCurrentPeriodEnd(
  subscription: Stripe.Subscription
): number | null {
  const fromRoot = (subscription as unknown as { current_period_end?: number })
    .current_period_end;
  if (typeof fromRoot === "number") return fromRoot;

  const fromItems = subscription.items?.data?.[0]?.current_period_end;
  if (typeof fromItems === "number") return fromItems;

  return null;
}

export async function resolveUserIdFromStripeCustomer(
  customerId: string
): Promise<string | null> {
  const stripe = getStripeClient();

  const byUser = await prisma.user.findUnique({
    where: { stripeCustomerId: customerId },
    select: { id: true },
  });
  if (byUser?.id) return byUser.id;

  const byLegacySubscription = await prisma.subscription.findFirst({
    where: { stripeCustomerId: customerId },
    select: { userId: true },
  });
  if (byLegacySubscription?.userId) return byLegacySubscription.userId;

  const customer = await stripe.customers.retrieve(customerId);
  if ("deleted" in customer) return null;

  return customer.metadata?.userId || null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Subscription sync
// ─────────────────────────────────────────────────────────────────────────────

export async function syncSubscriptionRecord(
  subscription: Stripe.Subscription,
  preferredUserId?: string | null
): Promise<void> {
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
      subscription.id
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

export async function syncFromInvoice(invoice: Stripe.Invoice): Promise<void> {
  const invoiceWithSubscription = invoice as Stripe.Invoice & {
    subscription?: string | Stripe.Subscription | null;
  };
  const subscriptionId =
    typeof invoiceWithSubscription.subscription === "string"
      ? invoiceWithSubscription.subscription
      : invoiceWithSubscription.subscription?.id;

  if (!subscriptionId) return;

  const stripe = getStripeClient();
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  await syncSubscriptionRecord(subscription);
}

export async function syncLeadsSubscription(
  subscription: Stripe.Subscription,
  preferredUserId?: string | null
): Promise<void> {
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

  console.log(
    `[leads] Synced subscription for user ${userId}: ${tier} (${subscription.status})`
  );
}

export async function syncCheckoutSession(
  checkoutSession: Stripe.Checkout.Session
): Promise<void> {
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
      data: { stripeCustomerId: customerId },
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Video fulfillment
// ─────────────────────────────────────────────────────────────────────────────

export async function fulfillVideoCredits(
  checkoutSession: Stripe.Checkout.Session
): Promise<boolean> {
  const userId = checkoutSession.metadata?.userId;
  if (!userId) return false;

  const product = checkoutSession.metadata?.product;

  if (product === "video_credits") {
    const credits = parseInt(checkoutSession.metadata?.credits || "0", 10);
    if (credits <= 0) return false;

    await prisma.videoCredit.upsert({
      where: { userId },
      create: {
        userId,
        balance: credits,
        totalPurchased: credits,
        packsPurchased: 1,
      },
      update: {
        balance: { increment: credits },
        totalPurchased: { increment: credits },
        packsPurchased: { increment: 1 },
      },
    });

    console.log(
      `[video] Credited ${credits} video credits to user ${userId} (pack purchase)`
    );
    return true;
  }

  if (product === "video_subscription") {
    const planId = checkoutSession.metadata?.planId;
    const monthlyCredits = parseInt(
      checkoutSession.metadata?.monthlyCredits || "0",
      10
    );
    const plan = SUBSCRIPTION_PLANS.find((p) => p.id === planId);
    if (!plan || monthlyCredits <= 0) return false;

    await prisma.videoCredit.upsert({
      where: { userId },
      create: {
        userId,
        balance: monthlyCredits,
        totalPurchased: monthlyCredits,
        subscriptionTier: plan.id,
        monthlyAllotment: monthlyCredits,
      },
      update: {
        balance: { increment: monthlyCredits },
        totalPurchased: { increment: monthlyCredits },
        subscriptionTier: plan.id,
        monthlyAllotment: monthlyCredits,
      },
    });

    console.log(
      `[video] Activated ${plan.name} subscription for user ${userId} (${monthlyCredits} credits/mo)`
    );
    return true;
  }

  return false;
}

export async function fulfillVideoSubscriptionRenewal(
  invoice: Stripe.Invoice
): Promise<void> {
  const customerId =
    typeof invoice.customer === "string"
      ? invoice.customer
      : invoice.customer?.id;
  if (!customerId) return;

  const lineItem = invoice.lines?.data?.[0] as
    | { price?: { id?: string } }
    | undefined;
  const priceId = lineItem?.price?.id;
  if (!priceId) return;

  const plan = SUBSCRIPTION_PLANS.find((p) => {
    const envPriceId = process.env[p.envKey];
    return envPriceId && envPriceId === priceId;
  });
  if (!plan) return;

  const userId = await resolveUserIdFromStripeCustomer(customerId);
  if (!userId) return;

  const current = await prisma.videoCredit.findUnique({ where: { userId } });
  const rollover = current ? Math.min(current.balance, plan.credits) : 0;

  await prisma.videoCredit.upsert({
    where: { userId },
    create: {
      userId,
      balance: plan.credits + rollover,
      totalPurchased: plan.credits,
      subscriptionTier: plan.id,
      monthlyAllotment: plan.credits,
      rolloverCredits: rollover,
    },
    update: {
      balance: plan.credits + rollover,
      totalPurchased: { increment: plan.credits },
      subscriptionTier: plan.id,
      monthlyAllotment: plan.credits,
      rolloverCredits: rollover,
    },
  });

  console.log(
    `[video] Renewed ${plan.name} for user ${userId}: ${plan.credits} + ${rollover} rollover`
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Shop sale fulfillment
// ─────────────────────────────────────────────────────────────────────────────

export async function fulfillShopSale(
  checkoutSession: Stripe.Checkout.Session
): Promise<boolean> {
  const shopItemId = checkoutSession.metadata?.shopItemId;
  if (!shopItemId) return false;

  // Legacy ShopItem update
  await prisma.shopItem
    .update({
      where: { id: shopItemId },
      data: { status: "sold", soldAt: new Date() },
    })
    .catch(() => {});

  const product = await prisma.product.findFirst({
    where: { shopItemId },
    include: { listings: { where: { platform: "shop" } } },
  });

  if (product) {
    const salePrice = (checkoutSession.amount_total || 0) / 100;
    const stripeFees = salePrice * 0.029 + 0.3;
    const cogs = product.totalCogs || 0;
    const netProfit = salePrice - stripeFees - cogs;

    await prisma.shopSale.create({
      data: {
        productId: product.id,
        platform: "shop",
        title: product.title,
        salePrice,
        platformFees: Math.round(stripeFees * 100) / 100,
        cogs: cogs || null,
        netProfit: Math.round(netProfit * 100) / 100,
        paymentMethod: "stripe",
      },
    });

    await prisma.product.update({
      where: { id: product.id },
      data: {
        status: "sold",
        soldPrice: salePrice,
        soldAt: new Date(),
        soldPlatform: "shop",
        totalFees: Math.round(stripeFees * 100) / 100,
        netProfit: Math.round(netProfit * 100) / 100,
        roi:
          cogs > 0
            ? Math.round((netProfit / cogs) * 10000) / 100
            : null,
      },
    });

    if (product.listings[0]) {
      await prisma.platformListing.update({
        where: { id: product.listings[0].id },
        data: { status: "sold", soldAt: new Date() },
      });
    }

    if (product.lotId) {
      const lotProducts = await prisma.product.findMany({
        where: { lotId: product.lotId, status: "sold" },
      });
      await prisma.sourceLot.update({
        where: { id: product.lotId },
        data: {
          totalSold: lotProducts.reduce((s, p) => s + (p.soldPrice || 0), 0),
          totalProfit: lotProducts.reduce(
            (s, p) => s + (p.netProfit || 0),
            0
          ),
          itemsSold: lotProducts.length,
        },
      });
    }

    console.log(
      `[shop] Product ${product.id} marked sold via Stripe ($${salePrice})`
    );
  }

  revalidatePath("/shop");
  console.log(`[shop] Item ${shopItemId} marked sold via Stripe`);
  return true;
}
