/**
 * POST /api/stripe/food/portal
 *
 * Creates a Stripe Billing Portal session so users can manage their
 * Ruthann's Kitchen subscription (cancel, update card, see invoices).
 */

import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getStripeClient } from "@/lib/stripe";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const household = await prisma.foodHousehold.findUnique({
    where: { userId: session.user.id },
  });

  if (!household?.stripeCustomerId) {
    return NextResponse.json(
      { error: "No Stripe customer on file" },
      { status: 404 }
    );
  }

  const stripe = getStripeClient();
  const origin = new URL(request.url).origin;

  const portal = await stripe.billingPortal.sessions.create({
    customer: household.stripeCustomerId,
    return_url: `${origin}/food/billing`,
  });

  return NextResponse.json({ url: portal.url });
}
