import { prisma } from "@/lib/prisma";
import { getStripeClient } from "@/lib/stripe";
import { resolvePlanFromPriceId, type PlanTier } from "@/lib/subscription";

type EnsureStripeCustomerArgs = {
  userId: string;
  email?: string | null;
};

export function getAppUrl(request?: Request) {
  const fromEnv =
    process.env.APP_URL || process.env.AUTH_URL || process.env.NEXTAUTH_URL;
  if (fromEnv) {
    return fromEnv.replace(/\/$/, "");
  }

  const fromOrigin = request?.headers.get("origin");
  return fromOrigin ? fromOrigin.replace(/\/$/, "") : "http://localhost:3000";
}

export function getPriceIds() {
  const basic =
    process.env.STRIPE_PRICE_BASIC_MONTHLY || process.env.STRIPE_PRICE_BASIC;
  const premium =
    process.env.STRIPE_PRICE_PREMIUM_MONTHLY || process.env.STRIPE_PRICE_PRO;

  if (!basic || !premium) {
    throw new Error(
      "Missing Stripe price env. Set STRIPE_PRICE_BASIC_MONTHLY and STRIPE_PRICE_PREMIUM_MONTHLY.",
    );
  }

  return { basic, premium };
}

export function getTierFromPriceId(priceId?: string | null): PlanTier {
  return resolvePlanFromPriceId(priceId);
}

export function getPriceIdForTier(tier: "basic" | "premium") {
  const priceIds = getPriceIds();
  return tier === "premium" ? priceIds.premium : priceIds.basic;
}

async function syncLegacySubscriptionRow(args: {
  userId: string;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  status?: string;
  priceId?: string | null;
  currentPeriodEnd?: Date | null;
}) {
  const { userId } = args;
  await prisma.subscription.upsert({
    where: { userId },
    create: {
      userId,
      stripeCustomerId: args.stripeCustomerId || null,
      stripeSubscriptionId: args.stripeSubscriptionId || null,
      status: args.status || "none",
      priceId: args.priceId || null,
      currentPeriodEnd: args.currentPeriodEnd || null,
    },
    update: {
      stripeCustomerId: args.stripeCustomerId || undefined,
      stripeSubscriptionId: args.stripeSubscriptionId || undefined,
      status: args.status || undefined,
      priceId: args.priceId || undefined,
      currentPeriodEnd: args.currentPeriodEnd || undefined,
    },
  });
}

export async function ensureStripeCustomer({
  userId,
  email,
}: EnsureStripeCustomerArgs) {
  const stripe = getStripeClient();

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      stripeCustomerId: true,
    },
  });

  if (user?.stripeCustomerId) {
    return user.stripeCustomerId;
  }

  const existingSubscription = await prisma.subscription.findUnique({
    where: { userId },
    select: {
      stripeCustomerId: true,
    },
  });

  if (existingSubscription?.stripeCustomerId) {
    await prisma.user.update({
      where: { id: userId },
      data: {
        stripeCustomerId: existingSubscription.stripeCustomerId,
      },
    });
    return existingSubscription.stripeCustomerId;
  }

  const customer = await stripe.customers.create({
    email: email || undefined,
    metadata: { userId },
  });

  await prisma.user.update({
    where: { id: userId },
    data: {
      stripeCustomerId: customer.id,
    },
  });

  await syncLegacySubscriptionRow({
    userId,
    stripeCustomerId: customer.id,
    status: "incomplete",
  });

  return customer.id;
}

export async function updateUserBillingState(args: {
  userId: string;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  subscriptionStatus: string;
  subscriptionTier: PlanTier;
  priceId?: string | null;
  currentPeriodEnd?: Date | null;
}) {
  await prisma.user.update({
    where: { id: args.userId },
    data: {
      stripeCustomerId: args.stripeCustomerId || null,
      stripeSubscriptionId: args.stripeSubscriptionId || null,
      subscriptionStatus: args.subscriptionStatus,
      subscriptionTier: args.subscriptionTier,
      currentPeriodEnd: args.currentPeriodEnd || null,
    },
  });

  await syncLegacySubscriptionRow({
    userId: args.userId,
    stripeCustomerId: args.stripeCustomerId,
    stripeSubscriptionId: args.stripeSubscriptionId,
    status: args.subscriptionStatus,
    priceId: args.priceId,
    currentPeriodEnd: args.currentPeriodEnd,
  });
}
