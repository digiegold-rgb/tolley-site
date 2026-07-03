/**
 * scripts/extend-food-trials-to-30.ts
 *
 * One-shot backfill: extend every currently-trialing Ruthann's Kitchen
 * subscription so trial_end = created_at + 30 days. Fair to early adopters
 * who signed up during the 7-day trial window before we switched to 30 days.
 *
 * Only extends — never shortens. Skips subs whose trial_end is already ≥30d.
 * Skips non-trialing statuses (active, canceled, past_due untouched).
 *
 * Usage:
 *   cd ~/tolley-site && npx tsx scripts/extend-food-trials-to-30.ts --dry-run
 *   cd ~/tolley-site && npx tsx scripts/extend-food-trials-to-30.ts
 *
 * Webhook will propagate the new trial_end back to FoodHousehold.trialEndsAt
 * automatically via customer.subscription.updated.
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function loadDotenv(path: string) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf-8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (!m) continue;
    if (process.env[m[1]]) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    process.env[m[1]] = v;
  }
}
loadDotenv(resolve(process.cwd(), ".env.vercel.production"));
loadDotenv(resolve(process.cwd(), ".env.local"));
loadDotenv(resolve(process.cwd(), ".env"));

import Stripe from "stripe";

const NEW_TRIAL_DAYS = 30;
const DRY_RUN = process.argv.includes("--dry-run");

async function main() {
  const apiKey = process.env.STRIPE_SECRET_KEY;
  if (!apiKey) {
    console.error("❌ STRIPE_SECRET_KEY not set");
    process.exit(1);
  }

  const priceId =
    process.env.STRIPE_FOOD_PRICE_ID ||
    process.env.STRIPE_FOOD_PRICE_ID_TEST ||
    "";
  if (!priceId) {
    console.error("❌ STRIPE_FOOD_PRICE_ID (or _TEST) not set");
    process.exit(1);
  }

  const mode = apiKey.startsWith("sk_live_") ? "LIVE" : "TEST";
  console.log(`\n🔑 Stripe mode: ${mode}`);
  console.log(`📦 Price:       ${priceId}`);
  console.log(`🎯 Target:      ${NEW_TRIAL_DAYS}-day trial window`);
  console.log(`🧪 Dry run:     ${DRY_RUN ? "YES (no changes)" : "NO (will write)"}\n`);

  const stripe = new Stripe(apiKey, {
    apiVersion: "2026-01-28.clover" as Stripe.LatestApiVersion,
  });

  // Pull every trialing sub on the food price. Paginates automatically.
  const trialing: Stripe.Subscription[] = [];
  for await (const sub of stripe.subscriptions.list({
    price: priceId,
    status: "trialing",
    limit: 100,
  })) {
    trialing.push(sub);
  }

  console.log(`Found ${trialing.length} trialing subscription${trialing.length === 1 ? "" : "s"}.\n`);

  if (trialing.length === 0) {
    console.log("Nothing to extend. Done.");
    return;
  }

  let extended = 0;
  let skipped = 0;

  for (const sub of trialing) {
    const customer = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
    const created = sub.created;
    const currentTrialEnd = sub.trial_end || 0;
    const desiredTrialEnd = created + NEW_TRIAL_DAYS * 86400;

    if (currentTrialEnd >= desiredTrialEnd) {
      console.log(
        `↷ skip  ${sub.id}  (cust ${customer})  trial_end already ≥30d: ${fmt(currentTrialEnd)}`
      );
      skipped += 1;
      continue;
    }

    const oldDate = fmt(currentTrialEnd);
    const newDate = fmt(desiredTrialEnd);
    const diffDays = Math.round((desiredTrialEnd - currentTrialEnd) / 86400);

    if (DRY_RUN) {
      console.log(
        `◇ dry   ${sub.id}  (cust ${customer})  ${oldDate} → ${newDate}  (+${diffDays}d)`
      );
      extended += 1;
      continue;
    }

    try {
      await stripe.subscriptions.update(sub.id, {
        trial_end: desiredTrialEnd,
        proration_behavior: "none",
      });
      console.log(
        `✓ ext   ${sub.id}  (cust ${customer})  ${oldDate} → ${newDate}  (+${diffDays}d)`
      );
      extended += 1;
    } catch (err) {
      console.error(
        `✗ fail  ${sub.id}  (cust ${customer})  ${err instanceof Error ? err.message : err}`
      );
    }
  }

  console.log(
    `\n${"━".repeat(60)}\n${DRY_RUN ? "Dry-run" : "Extended"}: ${extended}   Skipped: ${skipped}   Total: ${trialing.length}`
  );
  if (DRY_RUN) {
    console.log(`\nRe-run without --dry-run to apply.\n`);
  }
}

function fmt(unix: number): string {
  if (!unix) return "(none)";
  return new Date(unix * 1000).toISOString().slice(0, 10);
}

main().catch((err) => {
  console.error("\n❌ Fatal error:", err);
  process.exit(1);
});
