import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { ensureStripeCustomer, getAppUrl } from "@/lib/billing";
import { getStripeClient } from "@/lib/stripe";
import { getLeadsPriceIds, type LeadsTier } from "@/lib/leads-subscription";

export const runtime = "nodejs";

/**
 * POST /api/leads/subscribe
 *
 * Creates a Stripe checkout session for T-Agent Leads subscription.
 * Body: { tier: "starter" | "pro" | "team" }
 */
export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: "LOGIN_REQUIRED" }, { status: 401 });
  }

  try {
    const stripe = getStripeClient();
    const { tier } = (await request.json()) as { tier?: LeadsTier };

    if (!tier || !["starter", "pro", "team"].includes(tier)) {
      return NextResponse.json({ error: "Invalid tier" }, { status: 400 });
    }

    const priceIds = getLeadsPriceIds();
    const priceId = priceIds[tier as "starter" | "pro" | "team"];

    const stripeCustomerId = await ensureStripeCustomer({
      userId,
      email: session.user?.email,
    });

    const appUrl = getAppUrl(request);
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: stripeCustomerId,
      line_items: [{ price: priceId, quantity: 1 }],
      metadata: {
        userId,
        product: "leads",
        tier,
        priceId,
      },
      success_url: `${appUrl}/leads/onboard?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/leads/pricing`,
      allow_promotion_codes: true,
    });

    return NextResponse.json({
      url: checkoutSession.url,
      id: checkoutSession.id,
    });
  } catch (error) {
    console.error("leads checkout error", error);
    return NextResponse.json(
      { error: "Service temporarily unavailable" },
      { status: 503 }
    );
  }
}
