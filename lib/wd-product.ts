/**
 * Pure Wash & Dry Stripe product detectors. No Prisma / Twilio I/O.
 */

import type Stripe from "stripe";

export const WD_PRODUCT_ID = "prod_StRrSxJ969g4hV";
const WD_PRICE_IDS = new Set(["price_1Rxey029zOZYc3GpfoFkUbmv"]);

type StripePriceish = {
  id?: string;
  unit_amount?: number | null;
  product?: string | Stripe.Product | Stripe.DeletedProduct | null;
};

function priceProductId(price?: StripePriceish | null): string | null {
  const p = price?.product;
  if (!p) return null;
  return typeof p === "string" ? p : p.id;
}

/** Is this Stripe price part of the W/D product? */
export function isWdPrice(price?: StripePriceish | null): boolean {
  if (!price) return false;
  if (price.id && WD_PRICE_IDS.has(price.id)) return true;
  if (priceProductId(price) === WD_PRODUCT_ID) return true;
  return false;
}

export function isWdSubscription(sub: Stripe.Subscription): boolean {
  return isWdPrice(sub.items?.data?.[0]?.price as StripePriceish);
}

export function isWdInvoice(invoice: Stripe.Invoice): boolean {
  const line = invoice.lines?.data?.[0] as unknown as {
    pricing?: { price_details?: { price?: string; product?: string } };
    price?: StripePriceish;
  } | undefined;
  const pd = line?.pricing?.price_details;
  if (pd?.product === WD_PRODUCT_ID) return true;
  if (pd?.price && WD_PRICE_IDS.has(pd.price)) return true;
  if (line?.price && isWdPrice(line.price)) return true;
  return false;
}

/** First paid invoice for a new W/D subscription — not a renewal or proration. */
export function isWdSignupInvoice(invoice: Stripe.Invoice): boolean {
  if (invoice.status !== "paid") return false;
  if (!isWdInvoice(invoice)) return false;
  return invoice.billing_reason === "subscription_create";
}

export function isPaidWdCheckout(session: Pick<Stripe.Checkout.Session, "payment_status">): boolean {
  return session.payment_status === "paid" || session.payment_status === "no_payment_required";
}

export function isPaidWdSubscription(sub: Pick<Stripe.Subscription, "status">): boolean {
  return sub.status === "active" || sub.status === "trialing";
}
