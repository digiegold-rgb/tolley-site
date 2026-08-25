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
  /** Per-job dollars — render job id, `regen-<jobId>` repair passes, compose ids. */
  byJob?: Record<string, number | null | undefined> | null;
  /** Per-job, per-stage dollars (mirrors byJob) — lets a repair pass be
   *  subtracted stage-by-stage so the "where the $ went" rows still add up. */
  byJobStages?: Record<string, Record<string, number | null | undefined> | null | undefined> | null;
} | null | undefined;

/** The two columns every billing surface has in hand. */
export type BillableProjectShape = { costJson: unknown; settingsJson?: unknown };

function isFable5Project(settingsJson: unknown): boolean {
  return (
    !!settingsJson &&
    typeof settingsJson === "object" &&
    !Array.isArray(settingsJson) &&
    (settingsJson as { engine?: unknown }).engine === "fable5"
  );
}

/**
 * 🔴 Concierge repairs are HOUSE-PAID (2026-08-25). On a Fable 5 ticket the
 * customer is billed for the r1 render (the one debit at first sync); every
 * `regen-<jobId>` repair pass the concierge agent runs afterwards is Jelly's
 * cost of doing the job right, never the customer's. That was already the
 * rule for metered credit tenants (repairs never re-debit) but the unmetered
 * studio tenant is billed off `costJson.totalUsd`, which MERGES the regen
 * card — #51 (F5-EQT8K9) billed $5.76 of which $4.15 was the agent's own
 * repair round. The regen dollars stay on the card for cost-of-goods truth
 * and are stripped here, the one place every billing surface reads from.
 */
export function isHouseRepairJob(key: string): boolean {
  return key.startsWith("regen-");
}

/** Dollars on the card for concierge repair passes — 0 unless engine=fable5. */
export function houseRepairUsd(cost: CostCard, settingsJson: unknown): number {
  if (!isFable5Project(settingsJson)) return 0;
  let sum = 0;
  for (const [key, usd] of Object.entries(cost?.byJob ?? {})) {
    if (!isHouseRepairJob(key)) continue;
    sum += Number(usd ?? 0) || 0;
  }
  return sum;
}

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

/** Compute the customer is billed for, given the project row: card total
 *  minus separate-account stages minus house-paid concierge repairs. Use this
 *  over `billableComputeUsd` wherever `settingsJson` is in hand. */
export function billableComputeUsdForProject(p: BillableProjectShape): number {
  const cost = p.costJson as CostCard;
  return Math.max(0, billableComputeUsd(cost) - houseRepairUsd(cost, p.settingsJson));
}

/** byStage rows for the project: non-billable stages removed AND the
 *  house-paid repair pass subtracted stage-by-stage (fable5 only), so the
 *  rows add up to `billableComputeUsdForProject`. */
export function billableStagesForProject(p: BillableProjectShape): Array<[string, number]> {
  const cost = p.costJson as CostCard;
  const rows = billableStages(cost?.byStage);
  if (!isFable5Project(p.settingsJson)) return rows;
  const sub = new Map<string, number>();
  for (const [key, stages] of Object.entries(cost?.byJobStages ?? {})) {
    if (!isHouseRepairJob(key)) continue;
    for (const [stage, usd] of Object.entries(stages ?? {})) {
      sub.set(stage, (sub.get(stage) ?? 0) + (Number(usd ?? 0) || 0));
    }
  }
  return rows.map(([key, usd]) => [key, Math.max(0, usd - (sub.get(key) ?? 0))]);
}

/** byStage entries with the non-billable ones removed. */
export function billableStages(
  byStage: Record<string, { usd?: number | null } | null | undefined> | null | undefined,
): Array<[string, number]> {
  return Object.entries(byStage ?? {})
    .filter(([key]) => isBillableStage(key))
    .map(([key, v]) => [key, Number(v?.usd ?? 0) || 0]);
}
