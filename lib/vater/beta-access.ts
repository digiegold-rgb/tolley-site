/**
 * lib/vater/beta-access.ts — who may enter the studio, and whether signup
 * must redeem an invite.
 *
 * Jelly Studio is a public beta (2026-08-30): /signup?callbackUrl=/animate
 * creates a usable account with no code. Listing Studio stays invite-only.
 *
 * A supplied code is always validated — a wrong or spent code must not
 * silently pass just because the Jelly door is open.
 *
 * ZERO IMPORTS beyond the Product type so this stays usable from the
 * register route, /api/vater/me, and node:test.
 */

import type { Product } from "./product";

/** Redeem a code when one was typed, or when this is a Listing Studio signup. */
export function mustRedeemInvite(
  origin: Product,
  inviteCode: string | null | undefined,
): boolean {
  return Boolean(inviteCode) || origin === "realestate";
}

/** Owner / studio emails and redeemed invites always pass. Everyone else
 *  gets in on the Jelly public beta; Listing Studio still needs a code. */
export function studioAccessAllowed(args: {
  owner: boolean;
  studio: boolean;
  invited: boolean;
  product: Product;
}): boolean {
  if (args.owner || args.studio || args.invited) return true;
  return args.product !== "realestate";
}
