/**
 * POST /api/demo/checkout  — the no-conversation close for Engine 1.
 *
 * A prospect on /demo/[slug] clicks "Make it live" → this creates a Stripe
 * Checkout Session in subscription mode that bills BOTH:
 *   - $49/mo hosting  (recurring line_item, DEMO_SITE_MONTHLY_PRICE)
 *   - $500 setup      (one-time, added to the first invoice via add_invoice_items)
 *
 * On success Stripe sends them to /demo/<slug>/welcome (intake form). The
 * webhook (app/api/stripe/webhook) reads leadId/slug from session +
 * subscription metadata to mark the GrowthLead a paying client.
 *
 * Public by design (same as /api/demo/claim) — the lead is looked up by its
 * own demoUrl, input is the slug only, errors surface (no silent catch).
 */

import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getStripeClient } from "@/lib/stripe";
import {
  DEMO_SITE_PRODUCT_METADATA,
  DEMO_SITE_SETUP_PRICE,
  DEMO_SITE_MONTHLY_PRICE,
} from "@/lib/demo-site";

export const runtime = "nodejs";

interface CheckoutBody {
  slug?: unknown;
}

export async function POST(request: NextRequest) {
  let body: CheckoutBody;
  try {
    body = (await request.json()) as CheckoutBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const slug = typeof body.slug === "string" ? body.slug.trim().slice(0, 120) : "";
  if (!slug || !/^[a-z0-9-]+$/.test(slug)) {
    return NextResponse.json({ error: "Invalid demo slug" }, { status: 400 });
  }

  let lead: { id: string; name: string; email: string | null } | null;
  try {
    lead = await prisma.growthLead.findFirst({
      where: { demoUrl: `/demo/${slug}` },
      select: { id: true, name: true, email: true },
    });
  } catch (err) {
    console.error("[demo/checkout] lead lookup failed", err);
    return NextResponse.json(
      { error: "Could not start checkout — try again or call us" },
      { status: 500 }
    );
  }
  if (!lead) {
    return NextResponse.json({ error: "Demo not found" }, { status: 404 });
  }

  const origin = new URL(request.url).origin;
  const meta = {
    product: DEMO_SITE_PRODUCT_METADATA,
    leadId: lead.id,
    slug,
    business: lead.name,
  };

  try {
    const stripe = getStripeClient();
    const checkout = await stripe.checkout.sessions.create({
      mode: "subscription",
      // Subscription mode bills the recurring $49/mo line; the one-time $500
      // setup price rides along as a one-time invoice item on the FIRST
      // invoice. (Both in line_items — this Stripe types version doesn't
      // expose subscription_data.add_invoice_items.)
      line_items: [
        { price: DEMO_SITE_SETUP_PRICE, quantity: 1 },
        { price: DEMO_SITE_MONTHLY_PRICE, quantity: 1 },
      ],
      subscription_data: {
        metadata: meta,
      },
      ...(lead.email ? { customer_email: lead.email } : {}),
      billing_address_collection: "auto",
      allow_promotion_codes: false,
      success_url: `${origin}/demo/${slug}/welcome?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/demo/${slug}?checkout=cancelled`,
      metadata: meta,
    });

    if (!checkout.url) {
      return NextResponse.json(
        { error: "Failed to create checkout session" },
        { status: 500 }
      );
    }

    return NextResponse.json({ url: checkout.url });
  } catch (err) {
    console.error("[demo/checkout] stripe error", err);
    return NextResponse.json(
      { error: "Couldn't start checkout — call or text us instead" },
      { status: 500 }
    );
  }
}
