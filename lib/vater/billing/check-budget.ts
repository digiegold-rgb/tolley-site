/**
 * lib/vater/billing/check-budget.ts
 *
 * Pre-action budget gate. Order of checks:
 *   1. Trial caps (free-tier users blocked at 3 transcripts / 1 scene / 1 anim)
 *   2. Subscription status (must be active or trialing)
 *   3. User-set monthly spending cap (block if monthSpend + actionCost > limit)
 *
 * Returns { allow, reason, costCents, period }. The Generate route surfaces
 * the reason to the client so it can show TrialPaywallModal vs MonthlyLimitGuard.
 */

import { prisma } from "@/lib/prisma";
import {
  getActionPrice,
  isVaterAccessGranted,
  type VaterAction,
  type VaterTier,
} from "@/lib/vater-subscription";
import { checkTrialCaps, type TrialCapResult } from "./check-trial-caps";
import { getCurrentPeriod } from "./period";

export type BudgetReason =
  | "trial_cap_reached"
  | "subscription_inactive" // = no card on file (post-trial)
  | "payment_past_due" // an invoice failed; card must be updated
  | "monthly_limit_exceeded";

export interface BudgetCheckResult {
  allow: boolean;
  reason?: BudgetReason;
  costCents: number;
  /** Trial cap details, if reason === 'trial_cap_reached' */
  trial?: TrialCapResult;
  /** Monthly limit context, always populated for paid users */
  monthSpendCents?: number;
  monthLimitCents?: number;
  isTrial: boolean;
}

export async function checkBudget(
  userId: string,
  action: VaterAction,
  tier?: VaterTier | null,
  overrideCostCents?: number,
): Promise<BudgetCheckResult> {
  const costCents =
    overrideCostCents ?? getActionPrice(action, tier).costCents;

  // 1. Resolve card-on-file state FIRST — trial caps only apply to users
  // without a card. (Checking caps unconditionally would lock out paying
  // users who burned their free tier before adding a card.)
  const sub = await prisma.vaterSubscription.findUnique({
    where: { userId },
  });
  const isTrial = !sub || sub.status === "trialing" || sub.status === "none";

  // 2. Trial caps — free users blocked at the cap rather than charged
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

  // Trial users can run un-capped trial actions (script gen, voiceover, etc.)
  // until they hit the capped actions. Once capped, they need a subscription.
  // Capped actions for trial users: transcription, scene, animation. The trial
  // counter blocks those — so reaching this point on a non-capped action with
  // no subscription is fine.
  if (!isTrial && sub?.status === "past_due") {
    return {
      allow: false,
      reason: "payment_past_due",
      costCents,
      isTrial: false,
    };
  }

  if (!isTrial && !isVaterAccessGranted(sub?.status)) {
    return {
      allow: false,
      reason: "subscription_inactive",
      costCents,
      isTrial: false,
    };
  }

  // 3. Monthly spending cap (only enforced for paid users — trial actions don't charge)
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
