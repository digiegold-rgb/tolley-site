/**
 * GET /api/wd/checkout?plan=bundle|washer
 *
 * Washer/dryer signup is a dashboard Payment Link. This route turns on
 * Stripe Checkout shipping collection (labeled as the install address) on
 * that link, then redirects to it. Price, product, billing, and the
 * subscription are left as they are.
 *
 * If the link cannot be updated, a Checkout Session is created on the same
 * existing price with the same shipping collection. A required custom field
 * is used only when Checkout rejects shipping collection.
 */

import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";

import { rateLimitByIp } from "@/lib/rate-limit";
import { getStripeClient } from "@/lib/stripe";
import {
  WD_CHECKOUT_PLANS,
  checkoutInstallCollection,
  paymentLinkInstallUpdate,
  paymentLinkNeedsInstallCollection,
  paymentLinkSlug,
  withCheckoutQuery,
} from "@/lib/wd/install-address";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const readyLinks = new Map<string, string>();

function planOf(value: string | null): keyof typeof WD_CHECKOUT_PLANS | null {
  if (!value || value === "bundle") return "bundle";
  if (value === "washer") return "washer";
  return null;
}

function readPromo(value: string | null): string | null {
  const promo = (value || "").trim();
  return /^[A-Za-z0-9_-]{1,40}$/.test(promo) ? promo : null;
}

function readClientRef(value: string | null): string | null {
  const ref = (value || "").trim();
  return /^tolley_[A-Za-z0-9_-]{1,180}$/.test(ref) ? ref : null;
}

function stripeErrorText(err: unknown): string {
  if (!err || typeof err !== "object") return "";
  const param = "param" in err && typeof err.param === "string" ? err.param : "";
  const message = err instanceof Error ? err.message : "";
  return `${param} ${message}`;
}

async function findPaymentLink(stripe: Stripe, slug: string): Promise<Stripe.PaymentLink | null> {
  let startingAfter: string | undefined;
  for (let page = 0; page < 10; page++) {
    const list = await stripe.paymentLinks.list({ limit: 100, starting_after: startingAfter });
    const hit = list.data.find((link) => link.active && link.url.includes(slug));
    if (hit) return hit;
    if (!list.has_more || !list.data.length) return null;
    startingAfter = list.data[list.data.length - 1]?.id;
  }
  return null;
}

async function installCheckoutUrl(stripe: Stripe, spec: (typeof WD_CHECKOUT_PLANS)["bundle" | "washer"]): Promise<string | null> {
  const slug = paymentLinkSlug(spec.url);
  if (!slug) return null;
  const cached = readyLinks.get(slug);
  if (cached) return cached;
  const link = await findPaymentLink(stripe, slug);
  if (!link) return null;
  if (paymentLinkNeedsInstallCollection(link)) {
    await stripe.paymentLinks.update(link.id, paymentLinkInstallUpdate(link));
  }
  readyLinks.set(slug, link.url);
  return link.url;
}

async function promotionCodeId(stripe: Stripe, code: string): Promise<string | null> {
  const list = await stripe.promotionCodes.list({ code, active: true, limit: 1 });
  return list.data[0]?.id ?? null;
}

async function createInstallSession(
  stripe: Stripe,
  spec: (typeof WD_CHECKOUT_PLANS)["bundle" | "washer"],
  origin: string,
  promo: string | null,
  clientReferenceId: string | null,
): Promise<Stripe.Checkout.Session> {
  const promoId = promo ? await promotionCodeId(stripe, promo).catch(() => null) : null;
  const params: Stripe.Checkout.SessionCreateParams = {
    mode: "subscription",
    line_items: [{ price: spec.priceId, quantity: 1 }],
    phone_number_collection: { enabled: true },
    success_url: `${origin}/wd?checkout=success`,
    cancel_url: `${origin}/wd`,
    metadata: { product: "wd", plan: spec.plan },
    ...(clientReferenceId ? { client_reference_id: clientReferenceId } : {}),
    ...(promoId ? { discounts: [{ promotion_code: promoId }] } : { allow_promotion_codes: true }),
    ...checkoutInstallCollection("shipping"),
  };
  try {
    return await stripe.checkout.sessions.create(params);
  } catch (err) {
    if (!/shipping_address|custom_text/i.test(stripeErrorText(err))) throw err;
    return stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: spec.priceId, quantity: 1 }],
      phone_number_collection: { enabled: true },
      success_url: `${origin}/wd?checkout=success`,
      cancel_url: `${origin}/wd`,
      metadata: { product: "wd", plan: spec.plan },
      ...(clientReferenceId ? { client_reference_id: clientReferenceId } : {}),
      ...(promoId ? { discounts: [{ promotion_code: promoId }] } : { allow_promotion_codes: true }),
      ...checkoutInstallCollection("custom_field"),
    });
  }
}

export async function GET(request: NextRequest) {
  const plan = planOf(request.nextUrl.searchParams.get("plan"));
  if (!plan) return NextResponse.json({ error: "Unknown plan" }, { status: 400 });
  const spec = WD_CHECKOUT_PLANS[plan];
  const promo = readPromo(request.nextUrl.searchParams.get("prefilled_promo_code"));
  const clientReferenceId = readClientRef(request.nextUrl.searchParams.get("client_reference_id"));

  try {
    const limited = await rateLimitByIp(request, "wd:checkout", 60, 3600);
    if (limited) return limited;
  } catch (err) {
    console.warn("[wd/checkout] rate limit skipped", err);
  }

  try {
    const stripe = getStripeClient();
    try {
      const url = await installCheckoutUrl(stripe, spec);
      if (url) return NextResponse.redirect(withCheckoutQuery(url, promo, clientReferenceId), 303);
    } catch (err) {
      console.error("[wd/checkout] payment link install collection failed", err);
    }
    const session = await createInstallSession(stripe, spec, request.nextUrl.origin, promo, clientReferenceId);
    if (session.url) return NextResponse.redirect(session.url, 303);
  } catch (err) {
    console.error("[wd/checkout] falling back to the existing payment link", err);
  }

  return NextResponse.redirect(withCheckoutQuery(spec.url, promo, clientReferenceId), 303);
}
