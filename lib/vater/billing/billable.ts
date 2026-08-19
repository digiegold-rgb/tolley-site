/**
 * lib/vater/billing/billable.ts — what part of a video's cost card is
 * actually BILLABLE to the customer.
 *
 * 🔴 ElevenLabs is NEVER on a render bill (Jared 2026-08-19: "he has his own
 * account subscription … it should not be counted at all as it's a completely
 * separate charge entirely"). Every tenant narrates on their OWN ElevenLabs
 * plan (BYO key — rule 153), and Trey's "house" key IS his own subscription
 * too, so any `elevenlabs` dollars a card still carries (pre-8/17 renders,
 * owner-CLI renders that booked the PAYG list rate) are his plan's characters,
 * not Jelly cash. They stay on the card for cost-of-goods truth and are
 * stripped HERE, the one place every billing surface reads compute from:
 * summary.ts (pill + /hq due), ledger.ts (credit debits), the receipt route,
 * the library card, and scripts/vater-invoice.mjs.
 *
 * Client-safe on purpose (no "server-only") — the library card needs it.
 */

/** Stage keys that are a separate charge on the customer's own account. */
export const NON_BILLABLE_STAGES: ReadonlySet<string> = new Set(["elevenlabs"]);

export function isBillableStage(key: string): boolean {
  return !NON_BILLABLE_STAGES.has(key);
}

type CostCard = {
  totalUsd?: number | null;
  byStage?: Record<string, { usd?: number | null } | null | undefined> | null;
} | null | undefined;

/** Dollars on the card that belong to non-billable stages. */
export function nonBillableUsd(cost: CostCard): number {
  let sum = 0;
  for (const [key, v] of Object.entries(cost?.byStage ?? {})) {
    if (isBillableStage(key)) continue;
    sum += Number(v?.usd ?? 0) || 0;
  }
  return sum;
}

/** Compute the customer is billed for: card total minus separate-account
 *  stages, never negative. */
export function billableComputeUsd(cost: CostCard): number {
  const total = Number(cost?.totalUsd ?? 0) || 0;
  return Math.max(0, total - nonBillableUsd(cost));
}

/** byStage entries with the non-billable ones removed. */
export function billableStages(
  byStage: Record<string, { usd?: number | null } | null | undefined> | null | undefined,
): Array<[string, number]> {
  return Object.entries(byStage ?? {})
    .filter(([key]) => isBillableStage(key))
    .map(([key, v]) => [key, Number(v?.usd ?? 0) || 0]);
}
