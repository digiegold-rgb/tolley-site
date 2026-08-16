/**
 * lib/vater/credit-packs.ts — the credit-pack price list, and nothing else.
 *
 * ⚠️ ZERO IMPORTS, DELIBERATELY. This module is shared by the public landing
 * page (a client component) and by the server-side ledger. Its sibling
 * lib/vater/billing/ledger.ts pulls in Prisma and `server-only`, so anything
 * that imports the packs from THERE drags a database client into the browser
 * bundle and fails the build. Keep this file dependency-free so both sides can
 * use it, and so the four numbers on the marketing page can never drift from
 * the four numbers Stripe actually charges.
 *
 * Consumers:
 *   - lib/vater/billing/ledger.ts   (re-exports these; server-side truth)
 *   - app/api/vater/billing/packs   (creates the Checkout session)
 *   - components/animate/landing/** (public pricing section)
 */

/** Credit packs, in whole dollars. Round numbers on purpose — see below. */
export const CREDIT_PACKS = [10, 25, 50, 100] as const;
export type CreditPack = (typeof CREDIT_PACKS)[number];

/**
 * Stripe metadata discriminator for a credit-pack Checkout session. The
 * webhook routes on this exact string, so producer and consumer import one
 * constant rather than two copies of a string literal.
 */
export const JELLY_CREDITS_PRODUCT = "jelly_credits";

/**
 * Stripe's cut on a card payment: 2.9% + 30¢. We sell ROUND packs ($10, not
 * $10.61) and credit the net, stated plainly wherever a price appears:
 * "a $10 pack is $9.41 of credit — Stripe's fee is the whole difference."
 *
 * Grossing the price up instead would hide the fee behind an odd number and
 * make every pack look like a made-up price.
 *
 * floor(), never round(): crediting a fraction of a cent MORE than the money
 * that actually landed is a (tiny, compounding) real loss.
 * $10 → $9.41 · $25 → $23.98 · $50 → $48.25 · $100 → $96.80
 * (Within a cent of Stripe's own rounding, which floors the percentage part.)
 */
const STRIPE_PCT_KEPT = 0.971; // 1 − 2.9%
const STRIPE_FIXED_FEE_CENTS = 30;

/** Spendable credit, in cents, granted by a pack of `packDollars`. */
export function packCreditsCents(packDollars: number): number {
  const grossCents = Math.round(packDollars * 100);
  return Math.max(
    0,
    Math.floor((grossCents - STRIPE_FIXED_FEE_CENTS) * STRIPE_PCT_KEPT),
  );
}

export function isCreditPack(v: unknown): v is CreditPack {
  return CREDIT_PACKS.includes(Number(v) as CreditPack);
}

export interface CreditPackOption {
  pack: number;
  priceCents: number;
  creditsCents: number;
  /** priceCents − creditsCents: what Stripe takes. */
  feeCents: number;
}

/**
 * The full pack list, ready to render. Use this rather than mapping
 * CREDIT_PACKS by hand, so every surface shows the same three numbers.
 */
export function creditPackOptions(): CreditPackOption[] {
  return CREDIT_PACKS.map((pack) => {
    const priceCents = pack * 100;
    const creditsCents = packCreditsCents(pack);
    return { pack, priceCents, creditsCents, feeCents: priceCents - creditsCents };
  });
}
