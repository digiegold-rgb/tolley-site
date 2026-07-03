/**
 * POST /api/vater/billing/portal
 *
 * Opens a Stripe Customer Portal session for self-serve subscription
 * management (update card, view invoices, cancel).
 *
 * Response: { url }
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

  const sub = await prisma.vaterSubscription.findUnique({
    where: { userId: session.user.id },
  });
  if (!sub?.stripeCustomerId) {
    return NextResponse.json(
      { error: "No subscription on file" },
      { status: 400 },
    );
  }

  const stripe = getStripeClient();
  const origin = new URL(request.url).origin;

  const portal = await stripe.billingPortal.sessions.create({
    customer: sub.stripeCustomerId,
    return_url: `${origin}/animate`,
  });

  return NextResponse.json({ url: portal.url });
}
