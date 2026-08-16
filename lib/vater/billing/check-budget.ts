/**
 * lib/vater/billing/check-budget.ts
 *
 * Pre-action budget gate. Every generation route calls this BEFORE any DGX or
 * Modal work, and surfaces a 402 with `budget.reason` so the client can show
 * the right wall (components/animate/screens/editor/BillingBlock.tsx).
 *
 * ── 2026-08-15: PREPAID CREDITS (Model B) ────────────────────────────────
 * Order of checks is now:
 *   1. Unmetered (owner / Trey / any VaterAccount.unmetered) → always allow
 *   2. Credit balance ≥ what this action is expected to cost
 *
 * What that replaced: trial caps (3 transcripts / 1 scene / 1 animation), a
 * "card on file" requirement, and a self-set monthly ceiling. Those were the
 * scaffolding of the per-action-InvoiceItem model, which is off. A prepaid
 * balance IS the spending limit, and it is one the customer chose in dollars
 * rather than three unrelated counters.
 *
 * ⚠️ LEGACY FALLBACK, DELIBERATELY KEPT. The prod migration is applied by
 * hand after the deploy (see lib/vater/schema-probe.ts). If the credit table
 * is not there yet, "balance = 0" would mean NOBODY can render — a
 * self-inflicted outage in the window between push and migration. So when the
 * ledger is absent we fall through to exactly the rules that were live
 * before. The moment Jared runs the migration, credits take over with no
 * redeploy (the probe re-checks every 30s).
 */

import { prisma } from "@/lib/prisma";
import {
  getActionPrice,
  isVaterAccessGranted,
  type VaterAction,
  type VaterTier,
} from "@/lib/vater-subscription";
import { hasVaterUnmeteredAccess } from "@/lib/admin-auth";
import { checkTrialCaps, type TrialCapResult } from "./check-trial-caps";
import { getCurrentPeriod } from "./period";
import {
  estimateForProject,
  getBalance,
  MIN_ESTIMATE_USD,
} from "./ledger";

/**
 * Unmetered accounts generate without a balance check — they are billed
 * out-of-band instead (Trey settles by Zelle against the render bill; see
 * lib/vater/billing/summary.ts).
 *
 * Two grants, unioned: the env allowlists (owner +
 * VATER_STUDIO_ALLOWLIST_EMAILS) and VaterAccount.unmetered. The DB flag is
 * the one to use for new invites — flipping a beta tester to unmetered is a
 * row update, not a Vercel env edit + redeploy.
 *
 * ⚠️ Unmetered is independent of tier: a studio-tier beta user who pays
 * normally gets tier "studio" with unmetered=false and still hits this gate.
 * Don't reintroduce "studio implies free".
 */
export async function hasUnmeteredStudioAccess(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });
  return hasVaterUnmeteredAccess(userId, user?.email);
}

export type BudgetReason =
  | "insufficient_credits"
  // ── legacy reasons, only reachable before the credit migration lands ──
  | "trial_cap_reached"
  | "subscription_inactive" // = no card on file (post-trial)
  | "payment_past_due" // an invoice failed; card must be updated
  | "monthly_limit_exceeded";

export interface BudgetCheckResult {
  allow: boolean;
  reason?: BudgetReason;
  costCents: number;
  /** Trial cap details, if reason === 'trial_cap_reached' (legacy path) */
  trial?: TrialCapResult;
  /** Monthly limit context (legacy path) */
  monthSpendCents?: number;
  monthLimitCents?: number;
  isTrial: boolean;
  // ── credit-model context, populated whenever the ledger is live ──
  /** Spendable balance in cents. For 'animation', excludes stills-only grant. */
  balanceCents?: number;
  /** What this action is expected to cost, in cents. */
  estimateCents?: number;
  /** True when the blocking balance excluded a stills-only promo grant. */
  grantBlocked?: boolean;
}

/** Actions that reserve a whole video's worth of credit, not pocket change. */
const PROJECT_SCALE_ACTIONS = new Set<VaterAction>([
  "scene",
  "render",
  "animation",
]);

export interface CheckBudgetOptions {
  /**
   * The project this action belongs to. When present the gate reserves that
   * project's real estimate (planned minutes × rate); without it, a
   * project-scale action only has to clear the $1 estimate floor.
   */
  projectId?: string;
}

export async function checkBudget(
  userId: string,
  action: VaterAction,
  tier?: VaterTier | null,
  overrideCostCents?: number,
  opts?: CheckBudgetOptions,
): Promise<BudgetCheckResult> {
  const costCents = overrideCostCents ?? getActionPrice(action, tier).costCents;

  // 0. Unmetered studio access — never metered, never blocked.
  if (await hasUnmeteredStudioAccess(userId)) {
    return { allow: true, costCents: 0, isTrial: false };
  }

  // 1. Prepaid credits — the live model.
  const balance = await getBalance(userId);
  if (balance.ready) {
    // A stills-only promotional grant funds scripts, transcripts and stills.
    // Animation is the expensive half and needs money the customer actually
    // paid — that is the conversion moment, not part of the giveaway.
    const isAnimation = action === "animation";
    const spendableCents = isAnimation
      ? balance.purchasedCents
      : balance.balanceCents;

    let estimateUsd = MIN_ESTIMATE_USD;
    if (PROJECT_SCALE_ACTIONS.has(action)) {
      estimateUsd = opts?.projectId
        ? await estimateForProject(opts.projectId)
        : MIN_ESTIMATE_USD;
    } else {
      // Small actions (script, title, thumbnail, description, transcription,
      // voiceover) just need a funded account — pricing them individually was
      // the old model's fiction.
      estimateUsd = 0.01;
    }
    const estimateCents = Math.round(estimateUsd * 100);

    if (spendableCents < estimateCents) {
      return {
        allow: false,
        reason: "insufficient_credits",
        costCents,
        isTrial: false,
        balanceCents: spendableCents,
        estimateCents,
        grantBlocked: isAnimation && balance.grantCents > 0,
      };
    }
    return {
      allow: true,
      costCents,
      isTrial: false,
      balanceCents: spendableCents,
      estimateCents,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 2. LEGACY PATH — only reached before the credit migration is applied.
  //    Verbatim behaviour of the pre-2026-08-15 gate.
  // ─────────────────────────────────────────────────────────────────────────

  // Resolve card-on-file state FIRST — trial caps only apply to users without
  // a card. (Checking caps unconditionally would lock out paying users who
  // burned their free tier before adding a card.)
  const sub = await prisma.vaterSubscription.findUnique({ where: { userId } });
  const isTrial = !sub || sub.status === "trialing" || sub.status === "none";

  if (isTrial) {
    const trialResult = await checkTrialCaps(userId, action);
    if (!trialResult.allow) {
      return {
        allow: false,
        reason: "trial_cap_reached",
        costCents,
        trial: trialResult,
        isTrial: true,
      };
    }
  }

  if (!isTrial && sub?.status === "past_due") {
    return { allow: false, reason: "payment_past_due", costCents, isTrial: false };
  }

  if (!isTrial && !isVaterAccessGranted(sub?.status)) {
    return {
      allow: false,
      reason: "subscription_inactive",
      costCents,
      isTrial: false,
    };
  }

  if (!isTrial) {
    const period = await getCurrentPeriod(userId);
    const projected = period.usedCents + costCents;
    if (projected > period.limitCents) {
      return {
        allow: false,
        reason: "monthly_limit_exceeded",
        costCents,
        monthSpendCents: period.usedCents,
        monthLimitCents: period.limitCents,
        isTrial: false,
      };
    }
    return {
      allow: true,
      costCents,
      monthSpendCents: period.usedCents,
      monthLimitCents: period.limitCents,
      isTrial: false,
    };
  }

  return { allow: true, costCents, isTrial: true };
}
