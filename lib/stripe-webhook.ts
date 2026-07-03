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
import {
  isFoodPriceId,
  mapStripeStatusToFood,
  getSubscriptionPeriodEnd,
  getSubscriptionTrialEnd,
  FOOD_TRIAL_DAYS,
} from "@/lib/food-subscription";
import { sendWelcomeEmail, sendPaymentFailedEmail } from "@/lib/food/email";

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

// ─────────────────────────────────────────────────────────────────────────────
// Food (Ruthann's Kitchen) subscription sync
// ─────────────────────────────────────────────────────────────────────────────

export async function syncFoodSubscription(
  subscription: Stripe.Subscription,
  preferredUserId?: string | null
): Promise<void> {
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id;

  const metadataUserId = subscription.metadata?.userId;
  const metadataHouseholdId = subscription.metadata?.householdId;

  // Resolve the household: prefer metadata, fall back to customer ID lookup.
  let household = metadataHouseholdId
    ? await prisma.foodHousehold.findUnique({
        where: { id: metadataHouseholdId },
      })
    : null;

  if (!household) {
    household = await prisma.foodHousehold.findFirst({
      where: { stripeCustomerId: customerId },
    });
  }

  if (!household) {
    const userId =
      preferredUserId ||
      metadataUserId ||
      (await resolveUserIdFromStripeCustomer(customerId));
    if (userId) {
      household = await prisma.foodHousehold.findUnique({
        where: { userId },
      });
    }
  }

  if (!household) {
    console.warn(
      "[food] webhook sync skipped: unable to resolve household",
      subscription.id
    );
    return;
  }

  const priceId = subscription.items?.data?.[0]?.price?.id || null;
  const status = mapStripeStatusToFood(subscription.status);
  const periodEnd = getSubscriptionPeriodEnd(subscription);
  const trialEnd = getSubscriptionTrialEnd(subscription);
  const previousStatus = household.subscriptionStatus;

  await prisma.foodHousehold.update({
    where: { id: household.id },
    data: {
      subscriptionStatus: status,
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscription.id,
      stripePriceId: priceId,
      currentPeriodEnd: periodEnd,
      trialEndsAt: trialEnd,
      cancelAtPeriodEnd: subscription.cancel_at_period_end ?? false,
    },
  });

  console.log(
    `[food] Synced subscription for household ${household.id}: ${status} (${subscription.status})`
  );

  // Fire transactional emails on state transitions. Best-effort — errors here
  // must never fail the webhook (Stripe would retry and double-charge).
  try {
    const user = await prisma.user.findUnique({
      where: { id: household.userId },
      select: { email: true },
    });
    if (user?.email) {
      const becameTrialing =
        status === "trialing" && previousStatus !== "trialing" && previousStatus !== "active";
      const becamePastDue = status === "past_due" && previousStatus !== "past_due";
      if (becameTrialing) {
        await sendWelcomeEmail(user.email, FOOD_TRIAL_DAYS);
      } else if (becamePastDue) {
        await sendPaymentFailedEmail(user.email);
      }
    }
  } catch (emailErr) {
    console.warn("[food] transactional email failed (non-fatal)", emailErr);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Vater Studio subscription sync
// ─────────────────────────────────────────────────────────────────────────────

import {
  VATER_INCLUDED_USAGE_CENTS,
  isVaterPriceId,
  mapStripeStatusToVater,
  getSubscriptionPeriodEnd as getVaterPeriodEnd,
  getSubscriptionPeriodStart as getVaterPeriodStart,
} from "@/lib/vater-subscription";

export async function syncVaterSubscription(
  subscription: Stripe.Subscription,
  preferredUserId?: string | null,
): Promise<void> {
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id;

  const metadataUserId = subscription.metadata?.userId;

  // Resolve the user — prefer metadata, fall back to customer ID lookup.
  let userId: string | null =
    preferredUserId || metadataUserId || null;

  if (!userId) {
    const existing = await prisma.vaterSubscription.findFirst({
      where: { stripeCustomerId: customerId },
    });
    userId = existing?.userId ?? null;
  }

  if (!userId) {
    userId = await resolveUserIdFromStripeCustomer(customerId);
  }

  if (!userId) {
    console.warn(
      "[vater] webhook sync skipped: unable to resolve userId",
      subscription.id,
    );
    return;
  }

  const priceId = subscription.items?.data?.[0]?.price?.id || null;
  const status = mapStripeStatusToVater(subscription.status);
  const periodStart = getVaterPeriodStart(subscription);
  const periodEnd = getVaterPeriodEnd(subscription);

  const existing = await prisma.vaterSubscription.findUnique({
    where: { userId },
  });
  const wasActive = existing?.status === "active" || existing?.status === "trialing";
  const isNowActive = status === "active" || status === "trialing";

  await prisma.vaterSubscription.upsert({
    where: { userId },
    create: {
      userId,
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscription.id,
      stripePriceId: priceId,
      status,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: subscription.cancel_at_period_end ?? false,
      trialConvertedAt: status === "active" ? new Date() : null,
    },
    update: {
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscription.id,
      stripePriceId: priceId,
      status,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: subscription.cancel_at_period_end ?? false,
      // Stamp trialConvertedAt only on the first transition to active
      ...(status === "active" && !existing?.trialConvertedAt
        ? { trialConvertedAt: new Date() }
        : {}),
    },
  });

  // On first activation OR period renewal, issue the $250 credit grant.
  // We detect "period renewal" by comparing periodStart against the existing record.
  const periodChanged =
    !existing?.currentPeriodStart ||
    (periodStart &&
      existing.currentPeriodStart.getTime() !== periodStart.getTime());

  if (isNowActive && periodChanged && periodStart) {
    // Credit grants retired with the $288/mo model (2026-06-11) — pay-per-video
    // has no included usage. Legacy subscription syncs only roll the period.
    if (VATER_INCLUDED_USAGE_CENTS > 0) {
      await issueVaterCreditGrant({
        userId,
        stripeCustomerId: customerId,
        periodEnd,
      });
    }

    // Reset the monthly limit period anchor so the cache rolls over cleanly.
    await prisma.vaterMonthlyLimit.upsert({
      where: { userId },
      create: {
        userId,
        periodStart,
        usedCents: 0,
      },
      update: {
        periodStart,
        usedCents: 0,
        raisedAt: null,
      },
    });
  }

  console.log(
    `[vater] Synced subscription for user ${userId}: ${status} (was ${existing?.status ?? "new"})`,
  );

  if (status === "canceled" && wasActive) {
    console.log(`[vater] Subscription canceled for user ${userId}`);
    // Future: send cancellation email
  }
}

/**
 * Issue a $250 credit grant for the current Vater period. Best-effort —
 * Stripe Credit Grants API may require billing-meter feature flag; if it
 * fails we log and move on (the user just sees full usage charges this
 * period instead of $250 absorbed).
 */
async function issueVaterCreditGrant(opts: {
  userId: string;
  stripeCustomerId: string;
  periodEnd: Date | null;
}): Promise<void> {
  const stripe = getStripeClient();
  try {
    // The Stripe Node SDK exposes Credit Grants under stripe.billing.creditGrants
    // (available since SDK v17+). If the runtime doesn't have it we fall back
    // to a console warning — usage is still tracked, just no automatic discount.
    const billing = (stripe as unknown as {
      billing?: {
        creditGrants?: {
          create: (params: Record<string, unknown>) => Promise<{ id: string }>;
        };
      };
    }).billing;

    if (!billing?.creditGrants?.create) {
      console.warn(
        "[vater] stripe.billing.creditGrants not available — skipping $250 grant",
      );
      return;
    }

    const grant = await billing.creditGrants.create({
      customer: opts.stripeCustomerId,
      amount: { type: "monetary", monetary: { value: VATER_INCLUDED_USAGE_CENTS, currency: "usd" } },
      applicability_config: {
        scope: { price_type: "metered" },
      },
      category: "promotional",
      ...(opts.periodEnd ? { expires_at: Math.floor(opts.periodEnd.getTime() / 1000) } : {}),
      metadata: {
        product: "vater",
        userId: opts.userId,
      },
    });

    await prisma.vaterSubscription.update({
      where: { userId: opts.userId },
      data: { stripeCreditGrantId: grant.id },
    });

    console.log(
      `[vater] Issued $250 credit grant ${grant.id} for user ${opts.userId}`,
    );
  } catch (err) {
    console.error("[vater] Credit grant creation failed (non-fatal)", err);
  }
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

  const sessionAny = checkoutSession as unknown as {
    shipping_details?: {
      name?: string | null;
      address?: Record<string, unknown> | null;
    } | null;
    collected_information?: {
      shipping_details?: {
        name?: string | null;
        address?: Record<string, unknown> | null;
      } | null;
    } | null;
    customer_details?: {
      name?: string | null;
      email?: string | null;
      phone?: string | null;
      address?: Record<string, unknown> | null;
    } | null;
    total_details?: { amount_shipping?: number | null } | null;
  };

  const shipDetails =
    sessionAny.shipping_details ??
    sessionAny.collected_information?.shipping_details ??
    null;
  const shipAddress = shipDetails?.address ?? null;
  const buyerName =
    shipDetails?.name ?? sessionAny.customer_details?.name ?? null;
  const buyerEmail = sessionAny.customer_details?.email ?? null;
  const buyerPhone = sessionAny.customer_details?.phone ?? null;
  const shippingPaid =
    typeof sessionAny.total_details?.amount_shipping === "number"
      ? sessionAny.total_details.amount_shipping / 100
      : null;
  const buyerLocation = shipAddress
    ? [shipAddress.city, shipAddress.state].filter(Boolean).join(", ") || null
    : null;
  const shippingAddressJson = shipAddress
    ? { ...shipAddress, name: buyerName, phone: buyerPhone }
    : null;
  const fulfillment = shippingAddressJson ? "to_ship" : "pickup";

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
        shippingPaid,
        shippingAddress: shippingAddressJson ?? undefined,
        buyerName,
        buyerEmail,
        buyerPhone,
        buyerLocation,
        fulfillment,
        // Checkout doesn't ask for marketing consent today — defaults false
        // per Amazon's opted-in-messaging rule (see ShopSale.marketingOptIn
        // comment in schema.prisma). To collect real opt-ins here later, add
        // a checkbox to the Stripe Checkout success/cancel flow or a custom
        // field on the Checkout Session (Stripe supports `custom_fields`)
        // and thread it through to this call.
        marketingOptIn: false,
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
