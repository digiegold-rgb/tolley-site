/**
 * POST /api/biz/checkout — a customer buys an offering off an operator's
 * Launchpad storefront (/biz/<slug>).
 *
 * Body: { slug, offering }  (offering = the offering name shown on the page)
 *
 * Gates:
 *   - storefront must exist + be published
 *   - sellingEnabled must be true (Jared's handshake) — else 403 "locked"
 *   - demo storefronts (slug starts "demo-") return { demo:true, notice } so the
 *     demo account can be clicked through without a real charge
 *
 * One-time offerings → mode:"payment" with inline price_data (shop pattern).
 * Monthly offerings → mode:"subscription" with inline recurring price_data.
 * Either way metadata carries {product:"launchpad", operator, offering, kind,
 * amountCents} so the webhook can record the LaunchpadSale.
 */
import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";

import { prisma } from "@/lib/prisma";
import { getStripeClient } from "@/lib/stripe";
import { rateLimitByIp } from "@/lib/rate-limit";
import {
  LAUNCHPAD_PRODUCT_METADATA,
  isDemoStorefrontSlug,
  parseOfferings,
} from "@/lib/launchpad";

export const runtime = "nodejs";

interface CheckoutBody {
  slug?: unknown;
  offering?: unknown;
}

export async function POST(request: NextRequest) {
  const limited = await rateLimitByIp(request, "biz:checkout", 10, 3600);
  if (limited) return limited;

  let body: CheckoutBody;
  try {
    body = (await request.json()) as CheckoutBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const slug = typeof body.slug === "string" ? body.slug.trim().slice(0, 80) : "";
  const offeringName =
    typeof body.offering === "string" ? body.offering.trim().slice(0, 200) : "";

  if (!slug || !/^[a-z0-9-]+$/.test(slug)) {
    return NextResponse.json({ error: "Invalid storefront" }, { status: 400 });
  }

  const storefront = await prisma.storefront
    .findUnique({
      where: { slug },
      select: {
        id: true,
        businessName: true,
        published: true,
        sellingEnabled: true,
        offerings: true,
      },
    })
    .catch(() => null);

  if (!storefront || !storefront.published) {
    return NextResponse.json({ error: "Storefront not found" }, { status: 404 });
  }

  if (!storefront.sellingEnabled) {
    return NextResponse.json(
      { error: "This storefront isn't open for orders yet.", locked: true },
      { status: 403 },
    );
  }

  const offerings = parseOfferings(storefront.offerings);
  const offering =
    offerings.find((o) => o.name === offeringName) ||
    (offerings.length === 1 ? offerings[0] : null);

  if (!offering) {
    return NextResponse.json({ error: "Offering not found" }, { status: 404 });
  }
  if (offering.priceCents <= 0) {
    return NextResponse.json(
      { error: "This offering isn't priced yet — text to order." },
      { status: 400 },
    );
  }

  // Demo storefront: never create a real Stripe session.
  if (isDemoStorefrontSlug(slug)) {
    return NextResponse.json({
      demo: true,
      notice:
        "Demo storefront — checkout is turned off here. On a real operator's page, this button opens Stripe and the sale lands in their portal.",
    });
  }

  const origin = new URL(request.url).origin;
  const meta = {
    product: LAUNCHPAD_PRODUCT_METADATA,
    operator: slug,
    offering: offering.name,
    kind: offering.kind,
    amountCents: String(offering.priceCents),
  };

  try {
    const stripe = getStripeClient();
    const isMonthly = offering.kind === "monthly";

    const params: Stripe.Checkout.SessionCreateParams = {
      mode: isMonthly ? "subscription" : "payment",
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `${storefront.businessName} — ${offering.name}`,
              ...(offering.desc ? { description: offering.desc.slice(0, 500) } : {}),
            },
            unit_amount: offering.priceCents,
            ...(isMonthly ? { recurring: { interval: "month" as const } } : {}),
          },
          quantity: 1,
        },
      ],
      metadata: meta,
      ...(isMonthly ? { subscription_data: { metadata: meta } } : {}),
      billing_address_collection: "auto",
      // Operators deliver physical goods — collect where to send the order.
      shipping_address_collection: { allowed_countries: ["US"] },
      phone_number_collection: { enabled: true },
      success_url: `${origin}/biz/${slug}?purchased=1`,
      cancel_url: `${origin}/biz/${slug}?checkout=cancelled`,
    };

    const session = await stripe.checkout.sessions.create(params);
    if (!session.url) {
      return NextResponse.json(
        { error: "Failed to create checkout session" },
        { status: 500 },
      );
    }
    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("[biz/checkout] stripe error", err);
    return NextResponse.json(
      { error: "Couldn't start checkout — try again in a moment." },
      { status: 500 },
    );
  }
}
