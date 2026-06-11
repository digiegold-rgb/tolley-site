/**
 * lib/video-offer.ts
 *
 * Constants for the B2B "I made you a video" offer ($250 one-time + $99/mo
 * fresh videos). Stripe product "Tolley Promo Video" is provisioned by
 * scripts/setup-video-offer-product.mjs, which prints the two price IDs —
 * set them as VIDEO_OFFER_SETUP_PRICE / VIDEO_OFFER_MONTHLY_PRICE in env.
 *
 * Price IDs are read lazily from env (not baked constants like
 * lib/demo-site.ts) so a missing var throws a CLEAR error at checkout time
 * instead of shipping an empty price to Stripe.
 */

export const VIDEO_OFFER_PRODUCT_METADATA = "video_offer";

/** $250 one-time price ID. Throws if VIDEO_OFFER_SETUP_PRICE is unset. */
export function getVideoOfferSetupPrice(): string {
  const id = process.env.VIDEO_OFFER_SETUP_PRICE;
  if (!id) {
    throw new Error(
      "VIDEO_OFFER_SETUP_PRICE is not set — run scripts/setup-video-offer-product.mjs and add the printed price ID to env"
    );
  }
  return id;
}

/** $99/mo recurring price ID. Throws if VIDEO_OFFER_MONTHLY_PRICE is unset. */
export function getVideoOfferMonthlyPrice(): string {
  const id = process.env.VIDEO_OFFER_MONTHLY_PRICE;
  if (!id) {
    throw new Error(
      "VIDEO_OFFER_MONTHLY_PRICE is not set — run scripts/setup-video-offer-product.mjs and add the printed price ID to env"
    );
  }
  return id;
}

/**
 * True if the price ID belongs to the video offer. Deliberately does NOT
 * throw when the env vars are unset (webhook detection must never crash the
 * shared Stripe webhook for unrelated products) — unset env simply means
 * "not ours".
 */
export function isVideoOfferPriceId(priceId: string): boolean {
  if (!priceId) return false;
  const setup = process.env.VIDEO_OFFER_SETUP_PRICE;
  const monthly = process.env.VIDEO_OFFER_MONTHLY_PRICE;
  return (!!setup && priceId === setup) || (!!monthly && priceId === monthly);
}
