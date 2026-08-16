/**
 * scripts/vater-estimate-refund-smoke.ts
 *
 * Companion to scripts/vater-credits-smoke.ts, covering the 2026-08-16 lane:
 * pre-render estimates, the pricing calculator, the failed-render refund, the
 * referral bonus, and the tier-aware script cap.
 *
 *   npx tsx scripts/vater-estimate-refund-smoke.ts           # math only, no writes
 *   npx tsx scripts/vater-estimate-refund-smoke.ts --apply   # writes + cleans up
 *
 * --apply writes ledger rows against a throwaway `smoke-<timestamp>` userId and
 * a synthetic projectId, then deletes every row it wrote. It never touches a
 * real user's ledger, and it makes NO Stripe calls and no DGX calls.
 *
 * What it does NOT cover: the DGX estimate endpoint itself (a different lane),
 * and Stripe (there is no test key in this project's envs — see the header of
 * vater-credits-smoke.ts).
 */

import { prisma } from "../lib/prisma";
import {
  MIN_ESTIMATE_USD,
  MOTION_USD_PER_MIN,
  STILLS_USD_PER_MIN,
  fromDgxEstimate,
  localEstimate,
  planEstimate,
  plannedMinutes,
} from "../lib/vater/billing/estimate";
import {
  REFERRAL_BONUS_CENTS,
  getBalance,
  grantCredit,
  refundOnFailure,
} from "../lib/vater/billing/ledger";
import { getOpsRate } from "../lib/vater/billing/ops-fee";
import {
  BETA_MAX_WORDS,
  PAID_MAX_WORDS,
  isOverLength,
  lengthMessageFor,
} from "../lib/vater/script-limits";
import { hasVaterCreditLedgerTable } from "../lib/vater/schema-probe";

const APPLY = process.argv.includes("--apply");
const usd = (cents: number) => `$${(cents / 100).toFixed(2)}`;

function section(title: string) {
  console.log(`\n${"─".repeat(64)}\n${title}\n${"─".repeat(64)}`);
}

function check(label: string, pass: boolean, detail = ""): boolean {
  console.log(`  ${pass ? "OK  " : "FAIL"}  ${label}${detail ? `  ${detail}` : ""}`);
  return pass;
}

/** Pure arithmetic — runs with or without a database. */
function checkEstimateMath(): boolean {
  section("Estimate math (no DB, no DGX)");
  const rate = getOpsRate();
  console.log(
    `  stills $${STILLS_USD_PER_MIN.toFixed(2)}/min · motion +$${MOTION_USD_PER_MIN.toFixed(2)}/min · ops $${rate.toFixed(2)}/min · floor $${MIN_ESTIMATE_USD.toFixed(2)}\n`,
  );

  let ok = true;

  // Runtime signal precedence: finished audio > script words > target length.
  ok &&= check(
    "audio wins over words and target",
    plannedMinutes({ audioDuration: 300, scriptWords: 1850, targetDuration: 10 }) === 5,
  );
  ok &&= check(
    "1,850 words -> 10 min at 185 wpm",
    plannedMinutes({ scriptWords: 1850, targetDuration: 3 }) === 10,
  );
  ok &&= check(
    "falls back to target length",
    plannedMinutes({ targetDuration: 7 }) === 7,
  );

  const six = localEstimate({ minutes: 6, opsRatePerMinute: rate, sceneCount: 24 });
  console.log(
    `\n  6-minute video: draft $${six.draftUsd.toFixed(2)} · full $${six.fullUsd.toFixed(2)}` +
      `  (stills $${six.breakdown.stills.toFixed(2)}, motion $${six.breakdown.motion.toFixed(2)}, ops $${six.breakdown.ops.toFixed(2)})`,
  );
  ok &&= check("full costs more than draft", six.fullUsd > six.draftUsd);
  ok &&= check("draft carries no motion", localEstimate({ minutes: 6, opsRatePerMinute: rate, motionFraction: 0 }).fullUsd === six.draftUsd);
  ok &&= check("source is local", six.source === "local");

  const tiny = localEstimate({ minutes: 0.2, opsRatePerMinute: rate });
  ok &&= check(
    `30-second clip is floored at $${MIN_ESTIMATE_USD.toFixed(2)}`,
    tiny.draftUsd === MIN_ESTIMATE_USD,
    `got $${tiny.draftUsd.toFixed(2)}`,
  );

  // Hybrid: only the first 60s of a 6-minute video gets the motion pass.
  const hybrid = localEstimate({ minutes: 6, opsRatePerMinute: rate, motionFraction: 1 / 6 });
  ok &&= check(
    "hybrid quotes a sixth of the motion bill",
    Math.abs(hybrid.breakdown.motion - six.breakdown.motion / 6) < 0.02,
    `$${hybrid.breakdown.motion.toFixed(2)} vs $${six.breakdown.motion.toFixed(2)}`,
  );

  // The DGX shape, once that lane ships. Ops is added on OUR side.
  const dgx = fromDgxEstimate(
    { stillsUsd: 1.2, motionUsd: 8.4, ttsUsd: 0.3, totalDraftUsd: 1.5, totalFullUsd: 9.9, minutes: 6, sceneCount: 24 },
    rate,
  );
  ok &&= check("DGX payload parses", dgx !== null && dgx.source === "dgx");
  ok &&= check(
    "ops line added on top of DGX compute",
    !!dgx && Math.abs(dgx.fullUsd - (9.9 + 6 * rate)) < 0.02,
    dgx ? `$${dgx.fullUsd.toFixed(2)}` : "",
  );
  ok &&= check("a zero-runtime payload is rejected", fromDgxEstimate({ minutes: 0 }, rate) === null);

  return ok;
}

function checkCalculator(): boolean {
  section("Pricing calculator (the landing sliders)");
  const rate = getOpsRate();
  let ok = true;
  for (const [videos, minutes, motion] of [
    [8, 6, 0.3],
    [20, 3, 0],
    [4, 12, 1],
  ] as const) {
    const plan = planEstimate({
      videosPerMonth: videos,
      minutesPerVideo: minutes,
      motionShare: motion,
      opsRatePerMinute: rate,
    });
    console.log(
      `  ${String(videos).padStart(2)}×${minutes}min @ ${Math.round(motion * 100)}% motion` +
        ` -> $${plan.perVideoUsd.toFixed(2)}/video · $${plan.perMonthUsd.toFixed(2)}/month` +
        ` · $${plan.perMinuteUsd.toFixed(2)}/min`,
    );
    ok &&= Math.abs(plan.perMonthUsd - plan.perVideoUsd * videos) < 0.05;
  }
  ok = check("month = per-video × count", ok);
  // Planning figures are NOT floored — a floor would overstate a month of
  // short clips by several dollars.
  ok &&= check(
    "planning figures are not floored at $1",
    planEstimate({ videosPerMonth: 1, minutesPerVideo: 1, motionShare: 0, opsRatePerMinute: rate })
      .perVideoUsd < MIN_ESTIMATE_USD,
  );
  return ok;
}

function checkScriptCap(): boolean {
  section("Script length caps");
  let ok = true;
  ok &&= check(`beta cap is ${BETA_MAX_WORDS.toLocaleString()} words`, BETA_MAX_WORDS === 1700);
  ok &&= check(`paid cap is ${PAID_MAX_WORDS.toLocaleString()} words`, PAID_MAX_WORDS === 3700);
  ok &&= check("2,500 words is over the beta cap", isOverLength(2500, BETA_MAX_WORDS));
  ok &&= check("2,500 words is under the paid cap", !isOverLength(2500, PAID_MAX_WORDS));
  ok &&= check("owner (Infinity) is never over", !isOverLength(99999, Number.POSITIVE_INFINITY));
  console.log(`\n  beta message: ${lengthMessageFor(BETA_MAX_WORDS)}`);
  console.log(`  paid message: ${lengthMessageFor(PAID_MAX_WORDS)}`);
  return ok;
}

async function checkRefundAndReferral(): Promise<boolean> {
  section("Refund + referral (ledger round-trip)");

  if (!(await hasVaterCreditLedgerTable())) {
    console.log(
      "  VaterCreditLedger does not exist in this database yet — nothing to exercise.\n" +
        "  Apply it with:  npx tsx scripts/apply-jelly-tenancy-2026-08-15.ts --apply",
    );
    return true;
  }

  if (!APPLY) {
    console.log("  [dry run] would exercise, against a throwaway userId + projectId:");
    console.log("    debit a synthetic project      -> balance drops");
    console.log("    refundOnFailure                -> balance returns to where it started");
    console.log("    refundOnFailure again          -> already_refunded, no second payout");
    console.log(`    referral grant                  -> +${usd(REFERRAL_BONUS_CENTS)}, once only`);
    console.log("    cleanup                        -> deletes every row it wrote");
    console.log("\n  Re-run with --apply to actually execute it.");
    return true;
  }

  const userId = `smoke-${Date.now()}`;
  const projectId = `smokeproj-${Date.now()}`;
  const inviteeId = `smokeinvitee-${Date.now()}`;
  console.log(`  throwaway userId: ${userId}  projectId: ${projectId}`);
  let ok = true;

  try {
    // Seed spendable balance, then charge a synthetic render against it. The
    // debit is written directly rather than through debitForProject, which
    // needs a real finished YouTubeProject row.
    await grantCredit({
      userId,
      cents: 2000,
      dedupeKey: `smoke:seed:${userId}`,
      note: "smoke seed",
    });
    await prisma.vaterCreditLedger.create({
      data: {
        userId,
        deltaCents: -617,
        kind: "debit",
        projectId,
        dedupeKey: `debit:${projectId}`,
        note: "smoke render",
      },
    });

    const afterDebit = await getBalance(userId);
    ok &&= check("debit reduced the balance", afterDebit.balanceCents === 2000 - 617, usd(afterDebit.balanceCents));

    const r1 = await refundOnFailure(projectId, "smoke: render failed at compose");
    ok &&= check(
      "refund reversed the full charge",
      r1.refunded && r1.refundedCents === 617,
      `${usd(r1.refundedCents ?? 0)}`,
    );

    const afterRefund = await getBalance(userId);
    ok &&= check("balance is whole again", afterRefund.balanceCents === 2000, usd(afterRefund.balanceCents));

    const r2 = await refundOnFailure(projectId, "smoke: second call");
    ok &&= check("second refund is a no-op", !r2.refunded, r2.reason ?? "");

    // Referral bonus — same idempotency shape, keyed on the INVITEE.
    const ref1 = await grantCredit({
      userId,
      cents: REFERRAL_BONUS_CENTS,
      dedupeKey: `ref:${inviteeId}`,
      note: "smoke referral",
    });
    const ref2 = await grantCredit({
      userId,
      cents: REFERRAL_BONUS_CENTS,
      dedupeKey: `ref:${inviteeId}`,
      note: "smoke referral replay",
    });
    ok &&= check(
      `referral pays ${usd(REFERRAL_BONUS_CENTS)} exactly once`,
      ref1.granted && !ref2.granted,
      ref2.reason ?? "",
    );
  } finally {
    const byUser = await prisma.vaterCreditLedger.deleteMany({ where: { userId } });
    const byProject = await prisma.vaterCreditLedger.deleteMany({ where: { projectId } });
    console.log(`  cleanup: deleted ${byUser.count + byProject.count} row(s)`);
  }

  return ok;
}

async function main() {
  console.log(
    APPLY
      ? "MODE: APPLY — writes throwaway ledger rows, then deletes them. No Stripe, no DGX.\n"
      : "MODE: DRY RUN — math only, no writes. No Stripe, no DGX.\n",
  );

  const results = [
    ["estimate math", checkEstimateMath()],
    ["calculator", checkCalculator()],
    ["script caps", checkScriptCap()],
    ["refund + referral", await checkRefundAndReferral()],
  ] as const;

  section("Result");
  let allOk = true;
  for (const [name, ok] of results) {
    console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}`);
    allOk &&= ok;
  }
  if (!allOk) process.exitCode = 1;
}

main()
  .catch((err) => {
    console.error("FAILED:", err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
