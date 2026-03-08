import { NextResponse } from "next/server";

import { auth } from "@/auth";
import {
  ensureStripeCustomer,
  getAppUrl,
  getPriceIdForTier,
  getPriceIds,
  getTierFromPriceId,
} from "@/lib/billing";
import { getStripeClient } from "@/lib/stripe";
export const runtime = "nodejs";

type CheckoutPayload = {
  plan?: "basic" | "premium" | "pro";
  priceId?: string;
};

export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: "LOGIN_REQUIRED" }, { status: 401 });
  }

  try {
    const stripe = getStripeClient();
    const payload = (await request.json()) as CheckoutPayload;
    const priceIds = getPriceIds();
    const requestedPriceId = typeof payload.priceId === "string" ? payload.priceId : "";
    const fallbackTier =
      payload.plan === "premium" || payload.plan === "pro" ? "premium" : "basic";
    const priceId = requestedPriceId || getPriceIdForTier(fallbackTier);
    const selectedPlan = getTierFromPriceId(priceId);

    if (selectedPlan === "none" || ![priceIds.basic, priceIds.premium].includes(priceId)) {
      return NextResponse.json({ error: "Invalid priceId" }, { status: 400 });
    }

    const stripeCustomerId = await ensureStripeCustomer({
      userId,
      email: session.user?.email,
    });

    const appUrl = getAppUrl(request);
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: stripeCustomerId,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      metadata: {
        userId,
        plan: selectedPlan,
        priceId,
      },
      success_url: `${appUrl}/billing/success`,
      cancel_url: `${appUrl}/pricing`,
      allow_promotion_codes: true,
    });

    return NextResponse.json({
      url: checkoutSession.url,
      id: checkoutSession.id,
    });
  } catch (error) {
    console.error("checkout session error", error);
    return NextResponse.json(
      { error: "Service temporarily unavailable" },
      { status: 503 },
    );
  }
}
