/**
 * getVaterBillingSummary — the ONE place a tenant's render bill is computed.
 *
 * Consumed by /api/vater/latest (the /animate header pill) and
 * /api/hq/vater-payment (the /hq "Zelle received" reset button). All-time
 * total = compute at cost + render-operations fee; it NEVER resets.
 * Payments received (Zelle) accumulate in VaterPayment; current due is the
 * gap. Keep both surfaces on this helper — a fork here means the pill and
 * /hq disagree about what the tenant owes.
 *
 * 🔴 PER-TENANT since 2026-08-15. `userId` is REQUIRED — deliberately, so no
 * caller can fall back to an unscoped total and bill one tenant for another's
 * renders. Before scoping, the 11 legacy null-owner videos (April 2026, $0
 * compute but 13.66 finished minutes) were putting $4.78 of ops fee on Trey's
 * bill. Both the project population AND the payments are filtered by userId.
 *
 * The category breakdown lives here too (all-time AND "new since the last
 * payment"), because the same rows have to render on both surfaces. Every
 * payment stores a snapshot of the all-time state at the instant it was
 * recorded (recordVaterPayment below), so the new-charges breakdown is an
 * exact current − baseline diff. Payments taken before snapshots existed
 * fall back to attributing by project activity after the payment date, and
 * the remainder lands in a labelled carryover row so the rows ALWAYS sum to
 * the current due.
 */

import { prisma } from "@/lib/prisma";
import { hasVaterPaymentUserId } from "@/lib/vater/schema-probe";

import { getOpsRate } from "./ops-fee";

const r2 = (n: number) => Math.round(n * 100) / 100;

// Stage keys come straight from the per-video costJson.byStage records, so a
// category added later (a notebook run, a new provider) shows up on its own
// without a code change here. Unknown keys get a title-cased label.
const STAGE_LABELS: Record<string, string> = {
  anim: "Animation",
  fal_anim: "fal / Kling",
  reanimate: "Re-animation",
  stills: "Stills",
  render: "Render",
  modal_overhead: "Modal cold starts",
  llm: "LLM",
  gemini: "Gemini",
  tts: "Voice",
  compose: "Compose",
  duplicate_run: "Duplicate runs",
  reconciliation: "Billing true-ups",
};

export function stageLabel(key: string): string {
  return (
    STAGE_LABELS[key] ??
    key.replace(/_/g, " ").replace(/^./, (ch) => ch.toUpperCase())
  );
}

export interface BreakdownRow {
  key: string;
  label: string;
  usd: number;
}

/** New charges since the last payment — the "where did this amount come from". */
export interface VaterSinceLastPayment {
  /** ISO date of the payment this diff is measured from (null = never paid). */
  from: string | null;
  paymentId: string | null;
  /** "snapshot" = exact diff; "activity" = attributed by project activity. */
  basis: "snapshot" | "activity" | "all-time";
  computeUsd: number;
  opsUsd: number;
  /** computeUsd + opsUsd — new charges only, before carryover. */
  totalUsd: number;
  /** Unpaid balance that predates `from` (partial payments). */
  carryoverUsd: number;
  /** Rows including ops + carryover; sums to the current due. */
  rows: BreakdownRow[];
}

export interface VaterBillingSummary {
  opsRatePerMinute: number;
  minutes: number;
  videos: number;
  computeUsd: number;
  opsUsd: number;
  totalUsd: number;
  paidUsd: number;
  dueUsd: number;
  /** All-time compute breakdown by stage (ops fee is NOT in here). */
  breakdown: BreakdownRow[];
  since: VaterSinceLastPayment;
}

/** Shape stored on VaterPayment.snapshotJson at payment time. */
export interface VaterPaymentSnapshot {
  computeUsd: number;
  opsUsd: number;
  totalUsd: number;
  minutes: number;
  videos: number;
  breakdown: BreakdownRow[];
}

type StageMap = Map<string, number>;

function stageRows(totals: StageMap): BreakdownRow[] {
  return [...totals.entries()]
    .map(([key, usd]) => ({ key, label: stageLabel(key), usd: r2(usd) }))
    .filter((row) => row.usd > 0)
    .sort((a, b) => b.usd - a.usd);
}

function sumRows(rows: BreakdownRow[]): number {
  return r2(rows.reduce((a, row) => a + row.usd, 0));
}

export interface VaterBillingScope {
  /** Tenant whose bill this is. Required — see the header note. */
  userId: string;
}

/** Login email of the one tenant currently on out-of-band (Zelle) billing. */
const DEFAULT_BILLING_TENANT_EMAIL = "tvater326@gmail.com";

/**
 * Resolve the tenant for a machine caller that has no session — the /hq
 * console and the CONTENT_API_KEY POST path (scripts/vater-payment.mjs).
 * Explicit argument wins, then VATER_TREY_USER_ID, then a lookup by Trey's
 * login email. Returns null rather than guessing, so a caller that can't
 * name a tenant fails loudly instead of writing a payment against whoever
 * happens to be first in the table.
 */
export async function resolveVaterBillingTenant(
  explicitUserId?: string | null,
): Promise<string | null> {
  if (explicitUserId) return explicitUserId;
  const fromEnv = process.env.VATER_TREY_USER_ID?.trim();
  if (fromEnv) return fromEnv;
  const user = await prisma.user.findUnique({
    where: { email: DEFAULT_BILLING_TENANT_EMAIL },
    select: { id: true },
  });
  return user?.id ?? null;
}

/**
 * Columns VaterPayment had BEFORE the 2026-08-15 tenancy migration. Used to
 * read payments while the deployed code is ahead of the database — see the
 * warning in paymentsForTenant.
 */
const LEGACY_PAYMENT_SELECT = {
  id: true,
  amountUsd: true,
  method: true,
  note: true,
  createdAt: true,
  snapshotJson: true,
} as const;

/**
 * Payment rows for one tenant.
 *
 * Pre-migration (VaterPayment.userId absent) the column can't be selected or
 * filtered, so payments fall back to the ONE tenant that existed before
 * tenancy — Trey, the only Zelle payer. Any other tenant correctly sees zero
 * payments rather than being credited with his $144. Never "all payments
 * count for everyone".
 */
async function paymentsForTenant(userId: string) {
  if (await hasVaterPaymentUserId()) {
    const [paidAgg, lastPayment] = await Promise.all([
      prisma.vaterPayment.aggregate({
        where: { userId },
        _sum: { amountUsd: true },
      }),
      prisma.vaterPayment.findFirst({
        where: { userId },
        orderBy: { createdAt: "desc" },
      }),
    ]);
    return { paidUsd: paidAgg._sum.amountUsd ?? 0, lastPayment };
  }

  const legacyTenantId = await resolveVaterBillingTenant();
  if (legacyTenantId && legacyTenantId !== userId) {
    return { paidUsd: 0, lastPayment: null };
  }
  // ⚠️ Must select EXPLICITLY here. A bare findFirst/findMany asks for every
  // column in the Prisma model — including the userId the database doesn't
  // have yet — and throws P2022 even though nothing filters on it.
  const [paidAgg, lastPayment] = await Promise.all([
    prisma.vaterPayment.aggregate({ _sum: { amountUsd: true } }),
    prisma.vaterPayment.findFirst({
      orderBy: { createdAt: "desc" },
      select: LEGACY_PAYMENT_SELECT,
    }),
  ]);
  return { paidUsd: paidAgg._sum.amountUsd ?? 0, lastPayment };
}

/**
 * Newest payments for one tenant, for the /hq history strip. Same
 * pre-migration fallback as paymentsForTenant.
 */
export async function listVaterPayments(userId: string, take = 20) {
  if (await hasVaterPaymentUserId()) {
    return prisma.vaterPayment.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take,
    });
  }
  const legacyTenantId = await resolveVaterBillingTenant();
  if (legacyTenantId && legacyTenantId !== userId) return [];
  // Explicit select — the userId column doesn't exist yet. See above.
  return prisma.vaterPayment.findMany({
    orderBy: { createdAt: "desc" },
    take,
    select: LEGACY_PAYMENT_SELECT,
  });
}

export async function getVaterBillingSummary(scope: VaterBillingScope): Promise<{
  summary: VaterBillingSummary;
  costs: Awaited<ReturnType<typeof prisma.vaterCostSnapshot.findUnique>>;
}> {
  const { userId } = scope;
  const [costs, projects, payments] = await Promise.all([
    // NOTE: the cost snapshot is the GLOBAL Vater-lane ledger (whole-lane
    // spend incl. Jared's R&D), not a per-tenant figure. It is returned for
    // internal cost-of-goods surfaces only and is never part of `summary`.
    prisma.vaterCostSnapshot.findUnique({ where: { id: "vater-costs" } }),
    // youTubeProject.userId has existed since 2026-06-11, so this half of the
    // scoping works with or without the tenancy migration applied.
    prisma.youTubeProject.findMany({
      where: { userId },
      select: {
        status: true,
        finalVideoUrl: true,
        audioDuration: true,
        costJson: true,
        updatedAt: true,
        completedAt: true,
      },
    }),
    paymentsForTenant(userId),
  ]);
  const { lastPayment } = payments;

  const opsRatePerMinute = getOpsRate();
  const finished = projects.filter(
    (p) => p.status === "ready" && p.finalVideoUrl !== null,
  );
  let minutes = 0;
  for (const p of finished) {
    minutes += Math.max(0, Number(p.audioDuration ?? 0)) / 60;
  }
  // Trey is billed for the videos he received, so compute is the sum of the
  // delivered videos' own cards — the same figure vater-invoice.mjs prints.
  //
  // It used to come off the vaterCostSnapshot ledger rollup, which is every
  // dollar the Vater lane has ever spent: pipeline R&D, failed experiments,
  // repair passes, dev renders against the vater-* Modal apps. Ops was already
  // derived from finished videos, so the two halves of the total measured
  // different populations and the difference surfaced on the customer's bill
  // as a growing "Other" line ($34.70 by 2026-08-13). The snapshot stays the
  // internal cost-of-goods number; it is not what the customer owes.
  const cardUsd = (p: { costJson: unknown }) =>
    Number((p.costJson as { totalUsd?: number } | null)?.totalUsd ?? 0);
  const computeUsd = r2(finished.reduce((sum, p) => sum + cardUsd(p), 0));
  const opsUsd = r2(minutes * opsRatePerMinute);
  const paidUsd = r2(payments.paidUsd);

  // Due is SETTLEMENT-BASED: a payment settles everything delivered up to the
  // moment it landed, and due is only the videos delivered since. All-time is
  // paid + due — what has actually been billed.
  //
  // Due used to be all-time-minus-payments, which broke every time history
  // was corrected: the 8/10 $144 settle-up was priced by the old ledger
  // (whose phantom Kimi estimates happened to offset under-captured Modal),
  // so later corrections to either error re-opened a period Trey had already
  // settled and swung his balance — $62 due one day, $3.71 credit the next,
  // while Modal showed ~$60 of genuinely new spend. Under settlement
  // semantics, corrections to pre-payment history can never move current due.
  //
  // Delivery time is completedAt; updatedAt is only a fallback for legacy
  // rows without one, and is NOT reliable — true-ups and renumbering bump it,
  // which under the old math dragged settled videos back into the bill.
  const deliveredAt = (p: { completedAt: Date | null; updatedAt: Date }) =>
    p.completedAt ?? p.updatedAt;
  const settledUpTo = lastPayment?.createdAt ?? new Date(0);
  const finishedSince = finished.filter((p) => deliveredAt(p) > settledUpTo);
  let minutesSince = 0;
  for (const p of finishedSince) {
    minutesSince += Math.max(0, Number(p.audioDuration ?? 0)) / 60;
  }
  // A payment settles up to its AMOUNT, not merely up to its timestamp.
  // carryUsd is the shortfall frozen when the payment was recorded, so a
  // partial Zelle rolls its remainder forward instead of writing off the
  // difference: $100 against a $114.62 due used to read "Paid up ✓" and
  // drop $14.62 off the all-time total too (2026-08-18). Frozen at write
  // time, so corrections to pre-payment history still can't move due.
  const carryUsd = r2(
    Number((lastPayment as { carryUsd?: number } | null)?.carryUsd ?? 0),
  );
  const dueUsd = r2(
    finishedSince.reduce((sum, p) => sum + cardUsd(p), 0) +
      minutesSince * opsRatePerMinute +
      carryUsd,
  );
  const totalUsd = r2(paidUsd + dueUsd);

  const readStages = (
    rows: typeof projects,
    since?: Date,
  ): StageMap => {
    const totals: StageMap = new Map();
    for (const proj of rows) {
      if (since && proj.updatedAt <= since) continue;
      const cj = proj.costJson as
        | { byStage?: Record<string, { usd?: number }> }
        | null;
      for (const [key, v] of Object.entries(cj?.byStage ?? {})) {
        const usd = Number(v?.usd ?? 0);
        if (!usd) continue;
        totals.set(key, (totals.get(key) ?? 0) + usd);
      }
    }
    return totals;
  };

  // Same population as computeUsd above, so the stage rows add up to the
  // compute being charged instead of leaving a remainder.
  const allStages = readStages(finished);
  const breakdown = stageRows(allStages);
  // Should now be ~0. It stays as a guard: a delivered video whose card has a
  // total but no byStage detail would otherwise silently drop off the bill.
  const unattributedUsd = r2(computeUsd - sumRows(breakdown));
  if (unattributedUsd > 0.01) {
    breakdown.push({ key: "other", label: "Other", usd: unattributedUsd });
  }

  const summary: VaterBillingSummary = {
    opsRatePerMinute,
    minutes: r2(minutes),
    videos: finished.length,
    computeUsd,
    opsUsd,
    totalUsd,
    paidUsd,
    dueUsd,
    breakdown,
    since: buildSince({
      lastPayment,
      dueUsd,
      opsUsd,
      computeUsd,
      minutes,
      breakdown,
      opsRatePerMinute,
      newStagesFor: (since) => readStages(projects, since),
      newMinutesFor: (since) => {
        let m = 0;
        for (const p of finished) {
          if (p.updatedAt <= since) continue;
          m += Math.max(0, Number(p.audioDuration ?? 0)) / 60;
        }
        return m;
      },
    }),
  };

  return { summary, costs };
}

function buildSince(args: {
  lastPayment: { id: string; createdAt: Date; snapshotJson: unknown } | null;
  dueUsd: number;
  computeUsd: number;
  opsUsd: number;
  minutes: number;
  breakdown: BreakdownRow[];
  opsRatePerMinute: number;
  newStagesFor: (since: Date) => StageMap;
  newMinutesFor: (since: Date) => number;
}): VaterSinceLastPayment {
  const {
    lastPayment, dueUsd, computeUsd, opsUsd, breakdown,
    opsRatePerMinute, newStagesFor, newMinutesFor,
  } = args;

  // Never paid: the whole all-time bill IS the new amount.
  if (!lastPayment) {
    const rows = [...breakdown];
    if (opsUsd > 0.01) {
      rows.push({ key: "ops", label: "Render operations", usd: opsUsd });
    }
    return {
      from: null,
      paymentId: null,
      basis: "all-time",
      computeUsd,
      opsUsd,
      totalUsd: r2(computeUsd + opsUsd),
      carryoverUsd: 0,
      rows,
    };
  }

  const snap = lastPayment.snapshotJson as VaterPaymentSnapshot | null;
  let basis: VaterSinceLastPayment["basis"];
  let newCompute: number;
  let newOps: number;
  let rows: BreakdownRow[];

  if (snap && typeof snap.computeUsd === "number") {
    // Exact diff: every all-time row minus what it was at payment time.
    basis = "snapshot";
    const before = new Map(
      (snap.breakdown ?? []).map((row) => [row.key, Number(row.usd) || 0]),
    );
    rows = breakdown
      .map((row) => ({
        ...row,
        usd: r2(Math.max(0, row.usd - (before.get(row.key) ?? 0))),
      }))
      .filter((row) => row.usd > 0.005);
    newCompute = r2(Math.max(0, computeUsd - snap.computeUsd));
    newOps = r2(Math.max(0, opsUsd - (Number(snap.opsUsd) || 0)));
  } else {
    // Pre-snapshot payment: attribute by which projects moved after it.
    basis = "activity";
    const stages = newStagesFor(lastPayment.createdAt);
    rows = stageRows(stages);
    newOps = r2(newMinutesFor(lastPayment.createdAt) * opsRatePerMinute);
    // Unattributed all-time spend has no date — it falls into carryover.
    newCompute = sumRows(rows);
  }

  if (newOps > 0.005) {
    rows.push({ key: "ops", label: "Render operations", usd: newOps });
  }
  let newTotal = r2(newCompute + newOps);

  if (dueUsd <= 0.005) {
    // Paid up — nothing to explain.
    return {
      from: lastPayment.createdAt.toISOString(),
      paymentId: lastPayment.id,
      basis,
      computeUsd: 0,
      opsUsd: 0,
      totalUsd: 0,
      carryoverUsd: 0,
      rows: [],
    };
  }

  // Activity attribution over-counts: a project touched after the payment
  // carries costs (and minutes) that were already billed before it. Scale the
  // shares to the real due rather than inventing a phantom credit row — the
  // basis is labelled "activity" so the UI can say these are estimates.
  if (basis === "activity" && newTotal > dueUsd + 0.01 && newTotal > 0) {
    const k = dueUsd / newTotal;
    rows = rows.map((row) => ({ ...row, usd: r2(row.usd * k) }));
    newCompute = r2(newCompute * k);
    newOps = r2(newOps * k);
    newTotal = dueUsd;
  }

  // Rows must reconcile to what Trey owes RIGHT NOW. Anything left over is an
  // older unpaid balance (partial payment); anything over is credit.
  const carryoverUsd = r2(dueUsd - newTotal);
  if (carryoverUsd > 0.01) {
    rows.push({
      key: "carryover",
      label: "Unpaid before last payment",
      usd: carryoverUsd,
    });
  } else if (carryoverUsd < -0.01) {
    rows.push({
      key: "credit",
      label: "Credit from overpayment",
      usd: carryoverUsd,
    });
  }

  return {
    from: lastPayment.createdAt.toISOString(),
    paymentId: lastPayment.id,
    basis,
    computeUsd: newCompute,
    opsUsd: newOps,
    totalUsd: newTotal,
    carryoverUsd,
    rows,
  };
}

/**
 * recordVaterPayment — the ONE way a received payment gets written.
 *
 * Captures the all-time billing state as the payment's baseline BEFORE the
 * row is created, so the next "new since last payment" breakdown is an exact
 * diff. Both POST paths (/api/hq/vater-payment and /api/vater/latest) go
 * through here — a fork means a payment lands without a snapshot and the
 * breakdown silently degrades to activity attribution.
 *
 * Bookkeeping only: this never moves money.
 *
 * `userId` is REQUIRED and is stored on the row: a payment settles ONE
 * tenant's balance, and an unattributed payment would zero out every
 * tenant's due at once.
 */
export async function recordVaterPayment(input: {
  userId: string;
  amountUsd: number;
  method?: string;
  note?: string | null;
}) {
  const scope = { userId: input.userId };
  const { summary } = await getVaterBillingSummary(scope);
  // What this payment leaves unpaid (or overpays). summary.dueUsd already
  // includes any earlier carry, so this is cumulative by construction.
  const amountUsd = r2(input.amountUsd);
  const carryUsd = r2(summary.dueUsd - amountUsd);
  const snapshot: VaterPaymentSnapshot = {
    computeUsd: summary.computeUsd,
    opsUsd: summary.opsUsd,
    totalUsd: summary.totalUsd,
    minutes: summary.minutes,
    videos: summary.videos,
    breakdown: summary.breakdown,
  };
  // Pre-migration the userId column doesn't exist yet, so writing it would
  // throw. Omit it and let scripts/apply-jelly-tenancy-2026-08-15.ts backfill
  // — that script attributes every null-userId payment to the same default
  // tenant this path would have written.
  const canStoreUserId = await hasVaterPaymentUserId();
  const payment = await prisma.vaterPayment.create({
    data: {
      ...(canStoreUserId ? { userId: input.userId } : {}),
      amountUsd,
      carryUsd,
      method: (input.method || "zelle").slice(0, 40),
      note: typeof input.note === "string" ? input.note.slice(0, 300) : null,
      snapshotJson: snapshot as unknown as object,
    },
  });
  const { summary: fresh } = await getVaterBillingSummary(scope);
  return { payment, summary: fresh };
}
