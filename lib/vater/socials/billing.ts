/**
 * Up-front drip-batch quote. Owner / unmetered is $0. Metered accounts
 * currently pay $0 per scheduled post (the $6/mo lives on the connection,
 * see social-billing.ts). The 402 path stays so a future per-slot price
 * does not need a new route shape.
 */
import { hasUnmeteredStudioAccess } from "@/lib/vater/billing/check-budget";
import { getBalance } from "@/lib/vater/billing/ledger";

/** List price per scheduled video (one Zernio post, N platforms). */
export const DRIP_POST_CENTS = 0;

export interface DripQuote {
  unmetered: boolean;
  slotCount: number;
  unitCents: number;
  totalCents: number;
  balanceCents: number | null;
  allow: boolean;
}

export async function quoteDripBatch(
  userId: string,
  slotCount: number,
): Promise<DripQuote> {
  const slots = Math.max(0, Math.floor(slotCount));
  if (await hasUnmeteredStudioAccess(userId)) {
    return {
      unmetered: true,
      slotCount: slots,
      unitCents: 0,
      totalCents: 0,
      balanceCents: null,
      allow: true,
    };
  }
  const unitCents = DRIP_POST_CENTS;
  const totalCents = unitCents * slots;
  const balance = await getBalance(userId);
  const balanceCents = balance.ready ? balance.balanceCents : null;
  const allow = !balance.ready || balance.balanceCents >= totalCents;
  return {
    unmetered: false,
    slotCount: slots,
    unitCents,
    totalCents,
    balanceCents,
    allow,
  };
}
