/**
 * lib/vater/billing/ledger.ts — the prepaid credit ledger ("Model B").
 *
 * WHAT REPLACED WHAT (2026-08-15, Jelly Studio beta):
 *   Model A was a card on file + per-action Stripe InvoiceItems that accrued
 *   until they crossed $25. It priced actions with invented flat rates (25¢ a
 *   scene, $2.50 a render) that had no relationship to what the render
 *   actually cost, and it armed a live charging path against beta testers.
 *   Model B is prepaid: the customer buys credit, and a FINISHED video debits
 *   the real number — compute at cost plus $0.35 per finished minute.
 *
 * THE LEDGER IS THE BALANCE. There is no cached balance column anywhere: a
 * cache is a second truth, and the first webhook retry makes them disagree.
 * Balance = SUM(deltaCents). Every row carries the reason it moved.
 *
 * IDEMPOTENCY IS THE DATABASE'S JOB, not the caller's care:
 *   - purchases dedupe on the UNIQUE stripeSessionId
 *   - debits/grants/sweeps dedupe on the UNIQUE dedupeKey
 * A duplicated webhook, a re-poll of an already-finished job, or two invite
 * scripts run back to back all hit a constraint and return the existing row.
 *
 * ⚠️ SCHEMA MAY BE BEHIND THE CODE. Vercel deploys on `git push main`, but
 * the prod Neon migration is applied by hand from /hq's Must Complete queue
 * (prisma/migrations/20260815_vater_credit_ledger, staged into
 * scripts/apply-jelly-tenancy-2026-08-15.ts). Until it runs, every function
 * here reports `ready: false` / a zero balance rather than throwing — and the
 * budget gate falls back to the pre-existing rules rather than locking the
 * whole studio out. See lib/vater/billing/check-budget.ts.
 *
 * Related memory: vater-billing-ops-fee, vater-cost-truth-automated,
 * vater-payments-due-reset, hard-money-rule.
 */

import { prisma } from "@/lib/prisma";
import {
  hasVaterCreditLedgerTable,
  isMissingSchemaError,
} from "@/lib/vater/schema-probe";

import { referrerForUser } from "@/lib/vater/beta-invites";
import { rootUserIdFor } from "@/lib/vater/workspaces";

import {
  MEDIAN_COMPUTE_USD_PER_MIN,
  MIN_ESTIMATE_USD,
} from "./estimate";
import { billableComputeUsdForProject } from "./billable";
import { buildVideoBillingLine, getOpsRate } from "./ops-fee";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

export type LedgerKind = "purchase" | "grant" | "debit" | "refund" | "adjust";

/**
 * Pack prices + the Stripe-fee math live in lib/vater/credit-packs.ts, which
 * imports NOTHING. Re-exported here so server callers have one import, while
 * the public landing page can pull the same constants without dragging Prisma
 * and `server-only` into the browser bundle.
 */
export {
  CREDIT_PACKS,
  JELLY_CREDITS_PRODUCT,
  creditPackOptions,
  isCreditPack,
  packCreditsCents,
  type CreditPack,
  type CreditPackOption,
} from "@/lib/vater/credit-packs";

/** Promotional starter credit handed to a new invited beta user. */
export const STARTER_GRANT_CENTS = 1000; // $10
export const STARTER_GRANT_DAYS = 60;

/**
 * Referral bonus: paid to the REFERRER when someone who signed up on their
 * code renders their first billed video. Paid on the first debit, not on
 * signup, because signups are free to manufacture and a finished video is not.
 */
export const REFERRAL_BONUS_CENTS = 500; // $5
/** Referral credit never expires — it was earned, not gifted. */
export const REFERRAL_BONUS_DAYS: number | null = null;

/**
 * Median measured compute for a finished minute of Jelly video ($/min), and
 * the floor every quoted estimate is raised to.
 *
 * Both now live in lib/vater/billing/estimate.ts — the browser-safe module the
 * pricing calculator, the 402 wall and the estimate route all read — and are
 * re-exported here so the pre-existing server importers (check-budget.ts,
 * scripts/vater-credits-smoke.ts) keep one import. ONE definition, or the
 * marketing page and the budget gate quote different prices.
 */
export {
  MEDIAN_COMPUTE_USD_PER_MIN,
  MIN_ESTIMATE_USD,
} from "./estimate";

/**
 * 🔴 THE REPAIR CAP — the single constant that decides who eats an overrun.
 *
 * A video that needs three repair passes can cost several times its estimate.
 * That is OUR pipeline misbehaving, not the customer's choice, so the debit
 * is capped at REPAIR_CAP_MULTIPLE × the pre-render estimate and Tolley eats
 * the remainder. The full uncapped figure still lands in lineJson (and on the
 * receipt) so the real cost of goods is never hidden from ourselves.
 */
export const REPAIR_CAP_MULTIPLE = 3;

const r2 = (n: number) => Math.round(n * 100) / 100;
const toCents = (usd: number) => Math.round(usd * 100);

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface CreditBalance {
  /** False when the migration has not been applied yet — treat as "no data". */
  ready: boolean;
  /** SUM(deltaCents). Can only be negative through a manual adjust. */
  balanceCents: number;
  /**
   * Balance excluding unspent promotional grant credit. Animation actions
   * must be funded from THIS number — a stillsOnly grant buys stills and
   * scripts, not GPU-minutes of video.
   */
  purchasedCents: number;
  /** Unspent promotional grant credit (grants are consumed first). */
  grantCents: number;
  /** When the remaining grant credit disappears. */
  grantExpiresAt: Date | null;
  /** Lifetime purchased (positive purchase + refund rows). */
  lifetimePurchasedCents: number;
  /** Lifetime spent (absolute value of debit rows). */
  lifetimeSpentCents: number;
}

const EMPTY_BALANCE: CreditBalance = {
  ready: false,
  balanceCents: 0,
  purchasedCents: 0,
  grantCents: 0,
  grantExpiresAt: null,
  lifetimePurchasedCents: 0,
  lifetimeSpentCents: 0,
};

export interface VideoBillingLineJson {
  computeUsd: number;
  minutes: number;
  opsRate: number;
  opsUsd: number;
  /** What the video actually cost, uncapped. */
  totalUsd: number;
  /** The pre-render estimate this was measured against. */
  estimateUsd: number;
  /** Present only when the repair cap fired: the amount actually charged. */
  cappedAt?: number;
}

export interface DebitResult {
  ok: boolean;
  /** "created" | "existing" | "skipped" | "not_ready" */
  outcome: "created" | "existing" | "skipped" | "not_ready";
  reason?: string;
  chargedCents?: number;
  line?: VideoBillingLineJson;
}

// ─────────────────────────────────────────────────────────────────────────────
// Balance
// ─────────────────────────────────────────────────────────────────────────────

interface LedgerRowLite {
  id: string;
  deltaCents: number;
  kind: string;
  expiresAt: Date | null;
  dedupeKey: string | null;
}

/** A prior expiry sweep is bookkeeping, not the customer spending money. */
const isExpirySweep = (r: LedgerRowLite): boolean =>
  !!r.dedupeKey?.startsWith("adjust:expiry:");

/**
 * Grant credit that has not been consumed yet.
 *
 * Spend is applied to GRANTS FIRST, so promotional credit is what gets used
 * up while purchased balance sits untouched. Charging the purchased side
 * first would let a grant quietly expire under money the customer paid for.
 */
function unspentGrantCents(rows: LedgerRowLite[]): number {
  const grants = rows
    .filter((r) => r.kind === "grant" && r.deltaCents > 0)
    .reduce((a, r) => a + r.deltaCents, 0);
  const spent = rows
    .filter((r) => r.deltaCents < 0 && !isExpirySweep(r))
    .reduce((a, r) => a - r.deltaCents, 0);
  return Math.max(0, grants - spent);
}

/**
 * Expired grants are neutralised LAZILY: the first balance read after a grant
 * lapses writes a compensating 'adjust' row, so the sweep is visible in the
 * ledger the customer sees instead of happening invisibly inside a query.
 *
 * Grant credit is consumed FIRST (spend is applied to grants before purchased
 * balance), so the amount to sweep is whatever of the grant is still unspent.
 * The dedupeKey makes a double-sweep impossible even under concurrent reads.
 */
async function sweepExpiredGrants(
  userId: string,
  rows: LedgerRowLite[],
  now: Date,
): Promise<boolean> {
  const alreadySwept = new Set(
    rows
      .map((r) => r.dedupeKey)
      .filter((k): k is string => !!k && k.startsWith("adjust:expiry:"))
      .map((k) => k.slice("adjust:expiry:".length)),
  );
  const lapsed = rows.filter(
    (r) =>
      r.kind === "grant" &&
      r.deltaCents > 0 &&
      r.expiresAt !== null &&
      r.expiresAt <= now &&
      !alreadySwept.has(r.id),
  );
  if (lapsed.length === 0) return false;

  // Unspent grant credit right now, under "grants are spent first".
  let unspentGrant = unspentGrantCents(rows);

  let wrote = false;
  for (const grant of lapsed) {
    const sweepCents = Math.min(grant.deltaCents, unspentGrant);
    unspentGrant -= sweepCents;
    if (sweepCents <= 0) {
      // Fully spent before it lapsed — still stamp a $0 row so we stop
      // re-checking this grant on every future balance read.
    }
    try {
      await prisma.vaterCreditLedger.create({
        data: {
          userId,
          deltaCents: -sweepCents,
          kind: "adjust",
          expiresAt: null,
          dedupeKey: `adjust:expiry:${grant.id}`,
          note:
            sweepCents > 0
              ? `Promotional credit expired ($${(sweepCents / 100).toFixed(2)} unused)`
              : "Promotional credit expired (already spent)",
        },
      });
      wrote = true;
    } catch (err) {
      // P2002 = another request swept it first. Anything else is worth a log,
      // but never worth failing a balance read over.
      if ((err as { code?: string })?.code !== "P2002") {
        console.error("[vater-credits] grant expiry sweep failed", {
          userId,
          grantId: grant.id,
          err,
        });
      }
    }
  }
  return wrote;
}

export async function getBalance(userId: string): Promise<CreditBalance> {
  if (!(await hasVaterCreditLedgerTable())) return EMPTY_BALANCE;
  try {
    let rows = await prisma.vaterCreditLedger.findMany({
      where: { userId },
      select: {
        id: true,
        deltaCents: true,
        kind: true,
        expiresAt: true,
        dedupeKey: true,
      },
    });

    if (await sweepExpiredGrants(userId, rows, new Date())) {
      rows = await prisma.vaterCreditLedger.findMany({
        where: { userId },
        select: {
          id: true,
          deltaCents: true,
          kind: true,
          expiresAt: true,
          dedupeKey: true,
        },
      });
    }

    const balanceCents = rows.reduce((a, r) => a + r.deltaCents, 0);
    const liveGrants = rows.filter(
      (r) => r.kind === "grant" && r.deltaCents > 0,
    );
    // Sweeps have already removed lapsed grant credit from balanceCents, so
    // unspent grant can never exceed the balance itself.
    const grantCents = Math.min(
      unspentGrantCents(rows),
      Math.max(0, balanceCents),
    );
    const spent = rows
      .filter((r) => r.kind === "debit")
      .reduce((a, r) => a - r.deltaCents, 0);

    const grantExpiries = liveGrants
      .map((r) => r.expiresAt)
      .filter((d): d is Date => d !== null)
      .sort((a, b) => a.getTime() - b.getTime());

    return {
      ready: true,
      balanceCents,
      purchasedCents: balanceCents - grantCents,
      grantCents,
      grantExpiresAt: grantCents > 0 ? (grantExpiries[0] ?? null) : null,
      lifetimePurchasedCents: rows
        .filter((r) => r.kind === "purchase")
        .reduce((a, r) => a + r.deltaCents, 0),
      lifetimeSpentCents: spent,
    };
  } catch (err) {
    if (isMissingSchemaError(err)) return EMPTY_BALANCE;
    throw err;
  }
}

/** Recent ledger rows, newest first — the Billing screen's table. */
export async function listLedger(userId: string, take = 50) {
  if (!(await hasVaterCreditLedgerTable())) return [];
  try {
    return await prisma.vaterCreditLedger.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take,
    });
  } catch (err) {
    if (isMissingSchemaError(err)) return [];
    throw err;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Credits in
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The $10 promotional starter credit. Called by the invite flow, once per
 * user — the dedupeKey means calling it twice (a re-sent invite, a retried
 * script) can never hand out a second $10.
 *
 * stillsOnly: it funds scripts, transcripts and stills so a new tester can
 * see the product work end-to-end. Animation is the expensive half and needs
 * purchased balance — that's the conversion moment, not a giveaway.
 */
export async function grantStarterCredit(
  userId: string,
  opts?: { cents?: number; days?: number; note?: string },
): Promise<{ granted: boolean; reason?: string }> {
  if (!(await hasVaterCreditLedgerTable())) {
    return { granted: false, reason: "not_ready" };
  }
  // A workspace TAB is the same human — it never earns a second welcome
  // credit (lib/vater/workspaces.ts). The root already had its one.
  if ((await rootUserIdFor(userId)) !== userId) {
    return { granted: false, reason: "workspace" };
  }
  const cents = opts?.cents ?? STARTER_GRANT_CENTS;
  const days = opts?.days ?? STARTER_GRANT_DAYS;
  return grantCredit({
    userId,
    cents,
    dedupeKey: `grant:starter:${userId}`,
    expiresInDays: days,
    stillsOnly: true,
    note:
      opts?.note ??
      `Welcome credit — $${(cents / 100).toFixed(2)}, expires in ${days} days`,
  });
}

/**
 * Write an arbitrary `grant` row. The generic behind grantStarterCredit and
 * creditReferrerOnFirstDebit, and the ONLY way credit should be handed out —
 * every ledger write lives in this module so "the ledger is the balance" stays
 * true, and so idempotency is always the database's job via dedupeKey.
 *
 * `stillsOnly` grants fund scripts and still images but not the motion pass;
 * see the stills-only note on grantStarterCredit.
 */
export async function grantCredit(input: {
  userId: string;
  cents: number;
  dedupeKey: string;
  note: string;
  /** Days until the grant lapses. null/undefined = never expires. */
  expiresInDays?: number | null;
  stillsOnly?: boolean;
}): Promise<{ granted: boolean; reason?: string }> {
  if (input.cents <= 0) return { granted: false, reason: "zero_amount" };
  if (!(await hasVaterCreditLedgerTable())) {
    return { granted: false, reason: "not_ready" };
  }
  const expiresAt =
    input.expiresInDays && input.expiresInDays > 0
      ? new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000)
      : null;
  try {
    await prisma.vaterCreditLedger.create({
      data: {
        userId: input.userId,
        deltaCents: input.cents,
        kind: "grant",
        expiresAt,
        stillsOnly: input.stillsOnly ?? false,
        dedupeKey: input.dedupeKey,
        note: input.note,
      },
    });
    return { granted: true };
  } catch (err) {
    if ((err as { code?: string })?.code === "P2002") {
      return { granted: false, reason: "already_granted" };
    }
    if (isMissingSchemaError(err)) return { granted: false, reason: "not_ready" };
    throw err;
  }
}

/**
 * Pay the referral bonus for `inviteeUserId`, if they came in on someone
 * else's referral code.
 *
 * Called from debitForProject the moment the invitee's FIRST video is billed.
 * Two guards, both cheap:
 *   - dedupeKey `ref:<inviteeId>` — one bonus per invitee, ever, enforced by
 *     the unique index rather than by remembering to check first
 *   - self-referral is refused outright (mint your own code, sign up on it,
 *     render one video, print $5)
 *
 * Best-effort by contract: the caller has already taken the customer's money
 * for a video that exists, and a missing BetaInvite table or an unresolvable
 * referrer must never turn that into an error.
 */
export async function creditReferrerOnFirstDebit(
  inviteeUserId: string,
): Promise<{ credited: boolean; reason?: string; referrerId?: string }> {
  // Tabs have no invite of their own and must never mint a referral for the
  // human who created them.
  if ((await rootUserIdFor(inviteeUserId)) !== inviteeUserId) {
    return { credited: false, reason: "workspace" };
  }
  const referrerId = await referrerForUser(inviteeUserId);
  if (!referrerId) return { credited: false, reason: "no_referrer" };
  if (referrerId === inviteeUserId) {
    return { credited: false, reason: "self_referral" };
  }

  const result = await grantCredit({
    userId: referrerId,
    cents: REFERRAL_BONUS_CENTS,
    dedupeKey: `ref:${inviteeUserId}`,
    note: `Referral bonus — $${(REFERRAL_BONUS_CENTS / 100).toFixed(2)} for a friend's first video`,
    expiresInDays: REFERRAL_BONUS_DAYS,
  });
  return { credited: result.granted, reason: result.reason, referrerId };
}

/** Total referral credit this user has been paid, in cents. */
export async function referralEarningsCents(userId: string): Promise<number> {
  if (!(await hasVaterCreditLedgerTable())) return 0;
  try {
    const rows = await prisma.vaterCreditLedger.findMany({
      where: { userId, kind: "grant", dedupeKey: { startsWith: "ref:" } },
      select: { deltaCents: true },
    });
    return rows.reduce((a, r) => a + r.deltaCents, 0);
  } catch (err) {
    if (isMissingSchemaError(err)) return 0;
    throw err;
  }
}

/**
 * Record a completed credit-pack purchase. Idempotent on stripeSessionId, so
 * Stripe's at-least-once webhook delivery cannot double-credit.
 */
export async function recordPurchase(input: {
  userId: string;
  creditsCents: number;
  stripeSessionId: string;
  stripePaymentIntentId?: string | null;
  packDollars?: number | null;
  note?: string;
}): Promise<{ recorded: boolean; reason?: string }> {
  if (input.creditsCents <= 0) return { recorded: false, reason: "zero_amount" };
  if (!(await hasVaterCreditLedgerTable())) {
    // The money HAS moved — make this loud. The purchase is recoverable from
    // the Stripe session id once the migration lands.
    console.error(
      "[vater-credits] PURCHASE NOT RECORDED — ledger table missing",
      { userId: input.userId, session: input.stripeSessionId, cents: input.creditsCents },
    );
    return { recorded: false, reason: "not_ready" };
  }
  try {
    await prisma.vaterCreditLedger.create({
      data: {
        userId: input.userId,
        deltaCents: input.creditsCents,
        kind: "purchase",
        stripeSessionId: input.stripeSessionId,
        stripePaymentIntentId: input.stripePaymentIntentId ?? null,
        note:
          input.note ??
          (input.packDollars
            ? `$${input.packDollars} credit pack → $${(input.creditsCents / 100).toFixed(2)} credit (Stripe fee $${((input.packDollars * 100 - input.creditsCents) / 100).toFixed(2)})`
            : "Credit purchase"),
      },
    });
    return { recorded: true };
  } catch (err) {
    if ((err as { code?: string })?.code === "P2002") {
      return { recorded: false, reason: "duplicate" };
    }
    if (isMissingSchemaError(err)) return { recorded: false, reason: "not_ready" };
    throw err;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Estimates
// ─────────────────────────────────────────────────────────────────────────────

export interface ProjectEstimateShape {
  targetDuration?: number | null;
  audioDuration?: number | null;
}

/**
 * Pre-render estimate in dollars: planned minutes × (ops rate + median
 * compute), floored at $1.
 *
 * Planned minutes come from the finished audio when it exists (an accurate
 * number beats a guess) and from the project's target duration before that.
 * This is what the gate reserves against and what the repair cap multiplies.
 */
export function estimateUsdFor(project: ProjectEstimateShape): number {
  const audioMin = Number(project.audioDuration ?? 0) / 60;
  const plannedMin =
    audioMin > 0 ? audioMin : Math.max(0, Number(project.targetDuration ?? 0));
  const usd = plannedMin * (getOpsRate() + MEDIAN_COMPUTE_USD_PER_MIN);
  return r2(Math.max(MIN_ESTIMATE_USD, usd));
}

export async function estimateForProject(projectId: string): Promise<number> {
  const project = await prisma.youTubeProject.findUnique({
    where: { id: projectId },
    select: { targetDuration: true, audioDuration: true },
  });
  return estimateUsdFor(project ?? {});
}

// ─────────────────────────────────────────────────────────────────────────────
// Credits out
// ─────────────────────────────────────────────────────────────────────────────

interface DebitProjectShape {
  id: string;
  userId: string | null;
  status: string;
  finalVideoUrl: string | null;
  audioDuration: number | null;
  targetDuration: number | null;
  costJson: unknown;
  /** Optional — when present, Fable 5 repair passes are stripped (billable.ts). */
  settingsJson?: unknown;
  publishTitle: string | null;
  sourceTitle: string | null;
}

/** Compute the billing line + capped charge for a finished project. */
export function buildDebitLine(project: DebitProjectShape): {
  line: VideoBillingLineJson;
  chargeUsd: number;
} {
  // ElevenLabs never bills (customer's own subscription); Fable 5 repair
  // passes are house-paid — see billable.ts.
  const computeUsd = billableComputeUsdForProject(project);
  const bill = buildVideoBillingLine({
    projectId: project.id,
    title: project.publishTitle ?? project.sourceTitle ?? project.id,
    durationSeconds: Number(project.audioDuration ?? 0),
    computeUsd,
  });
  const estimateUsd = estimateUsdFor(project);
  const capUsd = r2(estimateUsd * REPAIR_CAP_MULTIPLE);

  const capped = bill.totalUsd > capUsd;
  const line: VideoBillingLineJson = {
    computeUsd: bill.computeUsd,
    minutes: bill.minutes,
    opsRate: getOpsRate(),
    opsUsd: bill.opsUsd,
    totalUsd: bill.totalUsd,
    estimateUsd,
    ...(capped ? { cappedAt: capUsd } : {}),
  };
  return { line, chargeUsd: capped ? capUsd : bill.totalUsd };
}

/**
 * Debit a finished video. ONE debit per project, ever — enforced by the
 * unique dedupeKey `debit:<projectId>`, so a re-poll of an already-ready job
 * (which happens constantly; the poll route is called every few seconds)
 * cannot bill twice.
 *
 * Never called for a failed render: the caller only reaches this on the
 * transition into `ready` with a final video, and this function re-checks.
 * Failed renders are never charged — that is a promise on the Billing screen.
 */
export async function debitForProject(
  projectId: string,
  opts?: { skip?: boolean; skipReason?: string },
): Promise<DebitResult> {
  if (opts?.skip) {
    return { ok: true, outcome: "skipped", reason: opts.skipReason ?? "unmetered" };
  }
  if (!(await hasVaterCreditLedgerTable())) {
    return { ok: false, outcome: "not_ready", reason: "ledger table missing" };
  }

  const project = (await prisma.youTubeProject.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      userId: true,
      status: true,
      finalVideoUrl: true,
      audioDuration: true,
      targetDuration: true,
      costJson: true,
      publishTitle: true,
      sourceTitle: true,
    },
  })) as DebitProjectShape | null;

  if (!project) return { ok: false, outcome: "skipped", reason: "no_project" };
  if (!project.userId) {
    // Legacy null-owner rows are admin-only and have no one to bill.
    return { ok: true, outcome: "skipped", reason: "no_owner" };
  }
  if (project.status !== "ready" || !project.finalVideoUrl) {
    return { ok: true, outcome: "skipped", reason: "not_finished" };
  }

  const { line, chargeUsd } = buildDebitLine(project);
  const chargeCents = toCents(chargeUsd);
  if (chargeCents <= 0) {
    return { ok: true, outcome: "skipped", reason: "zero_charge" };
  }

  try {
    await prisma.vaterCreditLedger.create({
      data: {
        userId: project.userId,
        deltaCents: -chargeCents,
        kind: "debit",
        projectId: project.id,
        dedupeKey: `debit:${project.id}`,
        lineJson: line as unknown as object,
        note: line.cappedAt
          ? `${project.publishTitle ?? project.sourceTitle ?? "Video"} — capped at ${REPAIR_CAP_MULTIPLE}× estimate (repair-cap)`
          : (project.publishTitle ?? project.sourceTitle ?? "Video"),
      },
    });
    if (line.cappedAt) {
      console.warn(
        `[vater-credits] repair-cap applied project=${project.id} cost=$${line.totalUsd.toFixed(2)} charged=$${chargeUsd.toFixed(2)} estimate=$${line.estimateUsd.toFixed(2)}`,
      );
    }

    /* Referral bonus fires on a real billed video, and only ever once per
     * invitee (dedupeKey `ref:<inviteeId>`), so calling it on every created
     * debit is safe — the second one hits the unique index and no-ops.
     * Wrapped: the customer has been charged and has their video, and a
     * referral payout is not worth failing that on. */
    try {
      const ref = await creditReferrerOnFirstDebit(project.userId);
      if (ref.credited) {
        console.log(
          `[vater-credits] referral bonus paid referrer=${ref.referrerId} invitee=${project.userId} project=${project.id}`,
        );
      }
    } catch (err) {
      console.error("[vater-credits] referral bonus failed", {
        userId: project.userId,
        projectId: project.id,
        err,
      });
    }

    return { ok: true, outcome: "created", chargedCents: chargeCents, line };
  } catch (err) {
    if ((err as { code?: string })?.code === "P2002") {
      return { ok: true, outcome: "existing", chargedCents: chargeCents, line };
    }
    if (isMissingSchemaError(err)) {
      return { ok: false, outcome: "not_ready", reason: "ledger table missing" };
    }
    throw err;
  }
}

/**
 * Debit a small NON-project action (Character Lab batches/imports). Unlike
 * small actions routed through recordUsage (usage rows only — money never
 * moves), this writes a real VaterCreditLedger debit so the balance drops.
 * Idempotent via the caller-supplied dedupeKey (e.g. `charbatch:<id>`).
 * Callers must skip this entirely for unmetered accounts (checkBudget
 * already reports costCents 0 for them).
 */
export async function debitForAction(
  userId: string,
  cents: number,
  dedupeKey: string,
  note: string,
): Promise<DebitResult> {
  if (cents <= 0) return { ok: true, outcome: "skipped", reason: "zero_charge" };
  if (!(await hasVaterCreditLedgerTable())) {
    return { ok: false, outcome: "not_ready", reason: "ledger table missing" };
  }
  try {
    await prisma.vaterCreditLedger.create({
      data: {
        userId,
        deltaCents: -cents,
        kind: "debit",
        dedupeKey,
        note,
      },
    });
    return { ok: true, outcome: "created", chargedCents: cents };
  } catch (err) {
    if ((err as { code?: string })?.code === "P2002") {
      return { ok: true, outcome: "existing", chargedCents: cents };
    }
    if (isMissingSchemaError(err)) {
      return { ok: false, outcome: "not_ready", reason: "ledger table missing" };
    }
    throw err;
  }
}

/** The debit row for a project, if one exists (receipt + reconciler). */
export async function getProjectDebit(projectId: string) {
  if (!(await hasVaterCreditLedgerTable())) return null;
  try {
    return await prisma.vaterCreditLedger.findUnique({
      where: { dedupeKey: `debit:${projectId}` },
    });
  } catch (err) {
    if (isMissingSchemaError(err)) return null;
    throw err;
  }
}

/**
 * 🔴 REFUND A FAILED RENDER.
 *
 * "Failed renders are never charged" is printed on the landing page, on the
 * Billing screen and inside the 402 wall. The debit path already honours it —
 * debitForProject only fires on the transition into `ready` — but three routes
 * can still leave a charge behind a failure:
 *   - a render that reached `ready`, was charged, and then failed a later
 *     revision pass that flipped it back
 *   - the cost reconciler true-ing up a project that has since failed
 *   - a manual/admin debit against a project that never delivered
 * This is the one function that reverses those, and it is what the promise
 * actually rests on.
 *
 * Reverses the FULL net charge for the project — the debit plus every adjust
 * against it — so a refunded project nets to exactly zero rather than to
 * whatever the original debit happened to be before a true-up.
 *
 * IDEMPOTENT on `refund:<projectId>`: the poll route calls this from a failure
 * branch that fires on every poll of a failed job, and a refund that pays out
 * twice is worse than one that never pays at all.
 */
export async function refundOnFailure(
  projectId: string,
  reason: string,
): Promise<{
  refunded: boolean;
  reason?: string;
  refundedCents?: number;
}> {
  if (!(await hasVaterCreditLedgerTable())) {
    return { refunded: false, reason: "not_ready" };
  }

  try {
    const rows = await prisma.vaterCreditLedger.findMany({
      where: { projectId, kind: { in: ["debit", "adjust", "refund"] } },
      select: { userId: true, deltaCents: true, kind: true, lineJson: true },
    });
    if (rows.length === 0) return { refunded: false, reason: "no_debit" };

    // Net cents the customer is currently out of pocket for this project.
    // Any prior refund row is in here too, so a partially-refunded project
    // refunds only the remainder.
    const netChargedCents = rows.reduce((a, r) => a - r.deltaCents, 0);
    if (netChargedCents <= 0) return { refunded: false, reason: "nothing_charged" };

    const debitRow = rows.find((r) => r.kind === "debit");
    const userId = debitRow?.userId ?? rows[0].userId;
    const priorLine = (debitRow?.lineJson ?? null) as VideoBillingLineJson | null;

    const trimmedReason = reason.trim().slice(0, 300) || "Render failed";

    await prisma.vaterCreditLedger.create({
      data: {
        userId,
        deltaCents: netChargedCents,
        kind: "refund",
        projectId,
        dedupeKey: `refund:${projectId}`,
        // Carry the original billing line so the receipt can still show what
        // the video would have cost, alongside the reason it cost nothing.
        lineJson: {
          ...(priorLine ?? {}),
          reason: trimmedReason,
          refundedCents: netChargedCents,
        } as unknown as object,
        note: `Refunded $${(netChargedCents / 100).toFixed(2)} — ${trimmedReason}`,
      },
    });

    console.log(
      `[vater-credits] refund project=${projectId} user=${userId} $${(netChargedCents / 100).toFixed(2)} — ${trimmedReason}`,
    );
    return { refunded: true, refundedCents: netChargedCents };
  } catch (err) {
    if ((err as { code?: string })?.code === "P2002") {
      return { refunded: false, reason: "already_refunded" };
    }
    if (isMissingSchemaError(err)) return { refunded: false, reason: "not_ready" };
    throw err;
  }
}

/** The refund row for a project, if one exists (receipt + reconciler). */
export async function getProjectRefund(projectId: string) {
  if (!(await hasVaterCreditLedgerTable())) return null;
  try {
    return await prisma.vaterCreditLedger.findUnique({
      where: { dedupeKey: `refund:${projectId}` },
    });
  } catch (err) {
    if (isMissingSchemaError(err)) return null;
    throw err;
  }
}

/**
 * True-up an existing debit after the cost reconciler corrects a project's
 * compute (scripts/vater-cost-reconcile.mjs). Writes a signed 'adjust' rather
 * than editing the debit, because a ledger that rewrites its own history
 * cannot be audited — and because the customer should be able to see the
 * correction, not just a number that changed.
 *
 * The repair cap applies here too: a true-up can never push the total charge
 * for a project past REPAIR_CAP_MULTIPLE × its estimate.
 */
export async function adjustProjectDebit(
  projectId: string,
  opts?: { thresholdUsd?: number },
): Promise<{
  adjusted: boolean;
  reason?: string;
  deltaCents?: number;
  fromUsd?: number;
  toUsd?: number;
}> {
  const threshold = opts?.thresholdUsd ?? 0.05;
  if (!(await hasVaterCreditLedgerTable())) {
    return { adjusted: false, reason: "not_ready" };
  }

  const debit = await getProjectDebit(projectId);
  if (!debit) return { adjusted: false, reason: "no_debit" };

  // A refunded project is settled. Re-charging it because the cost reconciler
  // found a truer compute number would silently undo the refund — the true-up
  // and the refund are both "adjust the total", and the refund wins.
  if (await getProjectRefund(projectId)) {
    return { adjusted: false, reason: "refunded" };
  }

  const project = (await prisma.youTubeProject.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      userId: true,
      status: true,
      finalVideoUrl: true,
      audioDuration: true,
      targetDuration: true,
      costJson: true,
      publishTitle: true,
      sourceTitle: true,
    },
  })) as DebitProjectShape | null;
  if (!project) return { adjusted: false, reason: "no_project" };

  const { line, chargeUsd } = buildDebitLine(project);

  // What the customer has been charged for this project so far: the debit
  // plus every prior adjust against it.
  const priorRows = await prisma.vaterCreditLedger.findMany({
    where: { projectId, kind: { in: ["debit", "adjust"] } },
    select: { deltaCents: true },
  });
  const chargedCents = priorRows.reduce((a, r) => a - r.deltaCents, 0);
  const targetCents = toCents(chargeUsd);
  const deltaCents = targetCents - chargedCents; // >0 = charge more

  if (Math.abs(deltaCents) < Math.round(threshold * 100)) {
    return { adjusted: false, reason: "within_threshold" };
  }

  const revision = priorRows.length; // 1 after the debit, 2 after one adjust…
  try {
    await prisma.vaterCreditLedger.create({
      data: {
        userId: debit.userId,
        deltaCents: -deltaCents,
        kind: "adjust",
        projectId,
        dedupeKey: `adjust:reconcile:${projectId}:${revision}`,
        lineJson: line as unknown as object,
        note: line.cappedAt
          ? `Cost true-up (capped at ${REPAIR_CAP_MULTIPLE}× estimate — repair-cap)`
          : `Cost true-up — $${(chargedCents / 100).toFixed(2)} → $${(targetCents / 100).toFixed(2)}`,
      },
    });
    return {
      adjusted: true,
      deltaCents,
      fromUsd: r2(chargedCents / 100),
      toUsd: r2(targetCents / 100),
    };
  } catch (err) {
    if ((err as { code?: string })?.code === "P2002") {
      return { adjusted: false, reason: "duplicate" };
    }
    if (isMissingSchemaError(err)) return { adjusted: false, reason: "not_ready" };
    throw err;
  }
}
