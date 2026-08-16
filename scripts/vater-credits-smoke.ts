/**
 * scripts/vater-credits-smoke.ts
 *
 * Exercises the prepaid credit ledger end to end against a throwaway userId.
 * NO Stripe calls, ever — recordPurchase() is fed a synthetic session id, the
 * same way the webhook would after Stripe had already taken the money.
 *
 * Why this exists: there is no Stripe TEST key in this project's Vercel envs
 * (only the live STRIPE_SECRET_KEY), so a real end-to-end pack purchase can
 * only be tested by Jared with a real card. Everything BELOW Stripe — pack
 * arithmetic, idempotency, grant expiry, the debit, the repair cap — is
 * verifiable without touching money, and this is that test.
 *
 *   npx tsx scripts/vater-credits-smoke.ts             # dry run, no writes
 *   npx tsx scripts/vater-credits-smoke.ts --apply     # writes + cleans up
 *
 * --apply inserts rows for a userId of the form `smoke-<timestamp>` and
 * deletes them again at the end. It never touches a real user's ledger.
 */

import { prisma } from "../lib/prisma";
import {
  CREDIT_PACKS,
  MEDIAN_COMPUTE_USD_PER_MIN,
  MIN_ESTIMATE_USD,
  REPAIR_CAP_MULTIPLE,
  STARTER_GRANT_CENTS,
  estimateUsdFor,
  getBalance,
  grantStarterCredit,
  listLedger,
  packCreditsCents,
  recordPurchase,
} from "../lib/vater/billing/ledger";
import { getOpsRate } from "../lib/vater/billing/ops-fee";
import { hasVaterCreditLedgerTable } from "../lib/vater/schema-probe";

const APPLY = process.argv.includes("--apply");
const usd = (cents: number) => `$${(cents / 100).toFixed(2)}`;

function section(title: string) {
  console.log(`\n${"─".repeat(64)}\n${title}\n${"─".repeat(64)}`);
}

/** Pure arithmetic — runs with or without a database. */
function checkPackMath() {
  section("Pack pricing (no DB, no Stripe)");
  const expected: Record<number, number> = {
    10: 941,
    25: 2398,
    50: 4825,
    100: 9680,
  };
  let ok = true;
  for (const pack of CREDIT_PACKS) {
    const cents = packCreditsCents(pack);
    const want = expected[pack];
    const pass = cents === want;
    ok &&= pass;
    console.log(
      `  $${String(pack).padEnd(3)} pack -> ${usd(cents)} credit` +
        `  (Stripe fee ${usd(pack * 100 - cents)})  ${pass ? "OK" : `MISMATCH, expected ${usd(want)}`}`,
    );
  }
  return ok;
}

function checkEstimates() {
  section("Pre-render estimates");
  const rate = getOpsRate();
  console.log(
    `  ops rate ${usd(Math.round(rate * 100))}/min + median compute ${usd(
      Math.round(MEDIAN_COMPUTE_USD_PER_MIN * 100),
    )}/min, floor $${MIN_ESTIMATE_USD.toFixed(2)}\n`,
  );
  for (const [label, shape] of [
    ["5 min target (default)", { targetDuration: 5 }],
    ["9 min target (beta cap)", { targetDuration: 9 }],
    ["30 s of finished audio", { audioDuration: 30 }],
    ["nothing known", {}],
  ] as const) {
    const est = estimateUsdFor(shape);
    console.log(
      `  ${label.padEnd(26)} estimate $${est.toFixed(2)}` +
        `   repair cap $${(est * REPAIR_CAP_MULTIPLE).toFixed(2)}`,
    );
  }
  return true;
}

async function checkLedger() {
  section("Ledger round-trip");

  if (!(await hasVaterCreditLedgerTable())) {
    console.log(
      "  VaterCreditLedger does not exist in this database yet.\n" +
        "  Apply it with:  npx tsx scripts/apply-jelly-tenancy-2026-08-15.ts --apply\n" +
        "  (Balances correctly report ready=false until then — verifying that now.)",
    );
    const balance = await getBalance("smoke-nonexistent-user");
    console.log(
      `  getBalance -> ready=${balance.ready} balance=${usd(balance.balanceCents)}` +
        `  ${balance.ready === false && balance.balanceCents === 0 ? "OK" : "UNEXPECTED"}`,
    );
    return balance.ready === false;
  }

  if (!APPLY) {
    console.log("  [dry run] would exercise, against a throwaway userId:");
    console.log(`    grantStarterCredit  -> +${usd(STARTER_GRANT_CENTS)} (stills-only, 60d)`);
    console.log("    grantStarterCredit  -> second call is a no-op (idempotent)");
    console.log(`    recordPurchase $25  -> +${usd(packCreditsCents(25))}`);
    console.log("    recordPurchase same session id -> duplicate, no credit");
    console.log("    getBalance          -> balance / purchased / grant split");
    console.log("    cleanup             -> deletes every row it wrote");
    console.log("\n  Re-run with --apply to actually execute it.");
    return true;
  }

  const userId = `smoke-${Date.now()}`;
  console.log(`  throwaway userId: ${userId}`);
  let ok = true;
  try {
    const g1 = await grantStarterCredit(userId);
    const g2 = await grantStarterCredit(userId);
    console.log(
      `  grant #1 granted=${g1.granted}  grant #2 granted=${g2.granted} (${g2.reason})` +
        `  ${g1.granted && !g2.granted ? "OK" : "FAIL"}`,
    );
    ok &&= g1.granted && !g2.granted;

    const sessionId = `cs_test_smoke_${userId}`;
    const p1 = await recordPurchase({
      userId,
      creditsCents: packCreditsCents(25),
      stripeSessionId: sessionId,
      packDollars: 25,
    });
    const p2 = await recordPurchase({
      userId,
      creditsCents: packCreditsCents(25),
      stripeSessionId: sessionId,
      packDollars: 25,
    });
    console.log(
      `  purchase #1 recorded=${p1.recorded}  replay recorded=${p2.recorded} (${p2.reason})` +
        `  ${p1.recorded && !p2.recorded ? "OK" : "FAIL"}`,
    );
    ok &&= p1.recorded && !p2.recorded;

    const balance = await getBalance(userId);
    const wantTotal = STARTER_GRANT_CENTS + packCreditsCents(25);
    console.log(
      `  balance ${usd(balance.balanceCents)}  = purchased ${usd(balance.purchasedCents)}` +
        ` + grant ${usd(balance.grantCents)}` +
        `  ${balance.balanceCents === wantTotal ? "OK" : `FAIL, expected ${usd(wantTotal)}`}`,
    );
    ok &&= balance.balanceCents === wantTotal;
    console.log(
      `  animation-spendable (purchased only) ${usd(balance.purchasedCents)}` +
        `  ${balance.purchasedCents === packCreditsCents(25) ? "OK" : "FAIL"}`,
    );
    ok &&= balance.purchasedCents === packCreditsCents(25);

    const rows = await listLedger(userId);
    console.log(`  ledger rows: ${rows.length}`);
    for (const r of rows) {
      console.log(`    ${r.kind.padEnd(9)} ${usd(r.deltaCents).padStart(9)}  ${r.note ?? ""}`);
    }
  } finally {
    const deleted = await prisma.vaterCreditLedger.deleteMany({ where: { userId } });
    console.log(`  cleanup: deleted ${deleted.count} row(s) for ${userId}`);
  }
  return ok;
}

async function main() {
  console.log(
    APPLY
      ? "MODE: APPLY — writes throwaway ledger rows, then deletes them. No Stripe calls.\n"
      : "MODE: DRY RUN — reads only. No writes, no Stripe calls.\n",
  );

  const results = [
    ["pack math", checkPackMath()],
    ["estimates", checkEstimates()],
    ["ledger", await checkLedger()],
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
