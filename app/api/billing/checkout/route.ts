import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { ensureStripeCustomer, getPriceIdForPlan } from "@/lib/billing";
import { getStripeClient } from "@/lib/stripe";
export const runtime = "nodejs";

type CheckoutPayload = {
  plan?: "basic" | "pro";
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
    const selectedPlan = payload.plan === "pro" ? "pro" : "basic";
    const priceId = getPriceIdForPlan(selectedPlan);
    const stripeCustomerId = await ensureStripeCustomer({
      userId,
      email: session.user?.email,
    });

    const origin = request.headers.get("origin") || process.env.AUTH_URL || "";
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
      success_url: `${origin}/?billing=success`,
      cancel_url: `${origin}/?billing=cancel`,
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
