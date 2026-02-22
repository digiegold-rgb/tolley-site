import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { ensureStripeCustomer } from "@/lib/billing";
import { getStripeClient } from "@/lib/stripe";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: "LOGIN_REQUIRED" }, { status: 401 });
  }

  try {
    const stripe = getStripeClient();
    const stripeCustomerId = await ensureStripeCustomer({
      userId,
      email: session.user?.email,
    });

    const origin = request.headers.get("origin") || process.env.AUTH_URL || "";
    const portal = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: `${origin}/`,
    });

    return NextResponse.json({
      url: portal.url,
    });
  } catch (error) {
    console.error("stripe portal error", error);
    return NextResponse.json(
      { error: "Service temporarily unavailable" },
      { status: 503 },
    );
  }
}
