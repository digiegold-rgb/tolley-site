import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { ensureStripeCustomer, getAppUrl } from "@/lib/billing";
import { getStripeClient } from "@/lib/stripe";
import { CREDIT_PACKS, SUBSCRIPTION_PLANS } from "@/lib/video";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id || !session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { type, packId, planId } = (await req.json()) as {
    type: "pack" | "subscription";
    packId?: string;
    planId?: string;
  };

  const stripe = getStripeClient();
  const customerId = await ensureStripeCustomer({
    userId: session.user.id,
    email: session.user.email,
  });

  const appUrl = getAppUrl(req);

  if (type === "pack") {
    const pack = CREDIT_PACKS.find((p) => p.id === packId);
    if (!pack) {
      return NextResponse.json({ error: "Invalid pack" }, { status: 400 });
    }

    const priceId = process.env[pack.envKey];
    if (!priceId) {
      return NextResponse.json(
        { error: `Stripe price not configured: ${pack.envKey}` },
        { status: 500 },
      );
    }

    const checkoutSession = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "payment",
      line_items: [{ price: priceId, quantity: 1 }],
      metadata: {
        userId: session.user.id,
        product: "video_credits",
        packId: pack.id,
        credits: String(pack.credits),
      },
      success_url: `${appUrl}/video?purchased=${pack.credits}`,
      cancel_url: `${appUrl}/video`,
    });

    return NextResponse.json({ url: checkoutSession.url });
  }

  if (type === "subscription") {
    const plan = SUBSCRIPTION_PLANS.find((p) => p.id === planId);
    if (!plan) {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
    }

    const priceId = process.env[plan.envKey];
    if (!priceId) {
      return NextResponse.json(
        { error: `Stripe price not configured: ${plan.envKey}` },
        { status: 500 },
      );
    }

    const checkoutSession = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      metadata: {
        userId: session.user.id,
        product: "video_subscription",
        planId: plan.id,
        monthlyCredits: String(plan.credits),
      },
      success_url: `${appUrl}/video?subscribed=${plan.id}`,
      cancel_url: `${appUrl}/video`,
    });

    return NextResponse.json({ url: checkoutSession.url });
  }

  return NextResponse.json({ error: "Invalid purchase type" }, { status: 400 });
}
