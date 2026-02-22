import { prisma } from "@/lib/prisma";
import { getStripeClient } from "@/lib/stripe";

type EnsureStripeCustomerArgs = {
  userId: string;
  email?: string | null;
};

export async function ensureStripeCustomer({
  userId,
  email,
}: EnsureStripeCustomerArgs) {
  const stripe = getStripeClient();

  const existingSubscription = await prisma.subscription.findUnique({
    where: {
      userId,
    },
  });

  if (existingSubscription?.stripeCustomerId) {
    return existingSubscription.stripeCustomerId;
  }

  const customer = await stripe.customers.create({
    email: email || undefined,
    metadata: {
      userId,
    },
  });

  await prisma.subscription.upsert({
    where: {
      userId,
    },
    create: {
      userId,
      stripeCustomerId: customer.id,
      status: "incomplete",
    },
    update: {
      stripeCustomerId: customer.id,
    },
  });

  return customer.id;
}

export function getPriceIdForPlan(plan: "basic" | "pro") {
  const priceId =
    plan === "pro" ? process.env.STRIPE_PRICE_PRO : process.env.STRIPE_PRICE_BASIC;

  if (!priceId) {
    throw new Error(`Missing Stripe price env for plan ${plan}`);
  }

  return priceId;
}
