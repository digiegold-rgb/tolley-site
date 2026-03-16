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
import { SUBSCRIPTION_PLANS } from "@/lib/video";

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

async function fulfillVideoCredits(checkoutSession: Stripe.Checkout.Session) {
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

    console.log(`[video] Credited ${credits} video credits to user ${userId} (pack purchase)`);
    return true;
  }

  if (product === "video_subscription") {
    const planId = checkoutSession.metadata?.planId;
    const monthlyCredits = parseInt(checkoutSession.metadata?.monthlyCredits || "0", 10);
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

    console.log(`[video] Activated ${plan.name} subscription for user ${userId} (${monthlyCredits} credits/mo)`);
    return true;
  }

  return false;
}

async function fulfillVideoSubscriptionRenewal(invoice: Stripe.Invoice) {
  const customerId =
    typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
  if (!customerId) return;

  // Check if this invoice is for a video subscription
  const lineItem = invoice.lines?.data?.[0] as { price?: { id?: string } } | undefined;
  const priceId = lineItem?.price?.id;
  if (!priceId) return;

  // Match against video subscription price IDs
  const plan = SUBSCRIPTION_PLANS.find((p) => {
    const envPriceId = process.env[p.envKey];
    return envPriceId && envPriceId === priceId;
  });
  if (!plan) return;

  const userId = await resolveUserIdFromStripeCustomer(customerId);
  if (!userId) return;

  // Rollover: save up to 1 month of unused credits
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

  console.log(`[video] Renewed ${plan.name} for user ${userId}: ${plan.credits} + ${rollover} rollover`);
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

        // Video credit purchase — fulfill credits
        if (await fulfillVideoCredits(checkoutSession)) {
          break;
        }

        // Shop item purchase — mark as sold + create ShopSale
        const shopItemId = checkoutSession.metadata?.shopItemId;
        if (shopItemId) {
          // Legacy ShopItem update
          await prisma.shopItem.update({
            where: { id: shopItemId },
            data: { status: "sold", soldAt: new Date() },
          }).catch(() => {});

          // New Product model — find by shopItemId link
          const product = await prisma.product.findFirst({
            where: { shopItemId },
            include: { listings: { where: { platform: "shop" } } },
          });

          if (product) {
            const salePrice = (checkoutSession.amount_total || 0) / 100;
            const stripeFees = salePrice * 0.029 + 0.30;
            const cogs = product.totalCogs || 0;
            const netProfit = salePrice - stripeFees - cogs;

            // Create ShopSale record
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

            // Update Product status
            await prisma.product.update({
              where: { id: product.id },
              data: {
                status: "sold",
                soldPrice: salePrice,
                soldAt: new Date(),
                soldPlatform: "shop",
                totalFees: Math.round(stripeFees * 100) / 100,
                netProfit: Math.round(netProfit * 100) / 100,
                roi: cogs > 0 ? Math.round((netProfit / cogs) * 10000) / 100 : null,
              },
            });

            // Update PlatformListing
            if (product.listings[0]) {
              await prisma.platformListing.update({
                where: { id: product.listings[0].id },
                data: { status: "sold", soldAt: new Date() },
              });
            }

            // Recompute lot P&L if linked
            if (product.lotId) {
              const lotProducts = await prisma.product.findMany({
                where: { lotId: product.lotId, status: "sold" },
              });
              await prisma.sourceLot.update({
                where: { id: product.lotId },
                data: {
                  totalSold: lotProducts.reduce((s, p) => s + (p.soldPrice || 0), 0),
                  totalProfit: lotProducts.reduce((s, p) => s + (p.netProfit || 0), 0),
                  itemsSold: lotProducts.length,
                },
              });
            }

            console.log(`[shop] Product ${product.id} marked sold via Stripe ($${salePrice})`);
          }

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
      case "invoice.paid": {
        const paidInvoice = event.data.object as Stripe.Invoice;
        await fulfillVideoSubscriptionRenewal(paidInvoice);
        await syncFromInvoice(paidInvoice);
        break;
      }
      case "invoice.payment_failed": {
        const failedInvoice = event.data.object as Stripe.Invoice;
        await syncFromInvoice(failedInvoice);
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
