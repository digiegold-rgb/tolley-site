/**
 * POST /api/v/checkout  — the no-conversation close for the VIDEO offer.
 *
 * A prospect on /v/[slug] clicks "Make it yours" → this creates a Stripe
 * Checkout Session in subscription mode that bills BOTH:
 *   - $99/mo fresh videos (recurring line_item, VIDEO_OFFER_MONTHLY_PRICE)
 *   - $250 one-time       (one-time price on the first invoice)
 *
 * On success Stripe sends them to /v/<slug>/welcome. The webhook
 * (app/api/stripe/webhook) reads leadId/slug from session + subscription
 * metadata to mark the GrowthLead a paying client.
 *
 * Public by design (same as /api/demo/checkout) — the lead is looked up by
 * its own videoUrl, input is the slug only, errors surface (no silent catch).
 */

import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getStripeClient } from "@/lib/stripe";
import {
  VIDEO_OFFER_PRODUCT_METADATA,
  getVideoOfferSetupPrice,
  getVideoOfferMonthlyPrice,
} from "@/lib/video-offer";

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
    return NextResponse.json({ error: "Invalid video slug" }, { status: 400 });
  }

  let lead: { id: string; name: string; email: string | null } | null;
  try {
    lead = await prisma.growthLead.findFirst({
      where: { videoUrl: `/v/${slug}` },
      select: { id: true, name: true, email: true },
    });
  } catch (err) {
    console.error("[v/checkout] lead lookup failed", err);
    return NextResponse.json(
      { error: "Could not start checkout — try again or call us" },
      { status: 500 }
    );
  }
  if (!lead) {
    return NextResponse.json({ error: "Video not found" }, { status: 404 });
  }

  const origin = new URL(request.url).origin;
  const meta = {
    product: VIDEO_OFFER_PRODUCT_METADATA,
    leadId: lead.id,
    slug,
    business: lead.name,
  };

  try {
    const stripe = getStripeClient();
    const checkout = await stripe.checkout.sessions.create({
      mode: "subscription",
      // Subscription mode bills the recurring $99/mo line; the one-time $250
      // price rides along as a one-time invoice item on the FIRST invoice.
      // (Both in line_items — same approach as /api/demo/checkout; this
      // Stripe types version doesn't expose subscription_data.add_invoice_items.)
      line_items: [
        { price: getVideoOfferSetupPrice(), quantity: 1 },
        { price: getVideoOfferMonthlyPrice(), quantity: 1 },
      ],
      subscription_data: {
        metadata: meta,
      },
      ...(lead.email ? { customer_email: lead.email } : {}),
      billing_address_collection: "auto",
      allow_promotion_codes: false,
      success_url: `${origin}/v/${slug}/welcome?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/v/${slug}?checkout=cancelled`,
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
    console.error("[v/checkout] stripe error", err);
    return NextResponse.json(
      { error: "Couldn't start checkout — call or text us instead" },
      { status: 500 }
    );
  }
}
