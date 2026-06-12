/**
 * scripts/wd-sale-package.mjs — generates the W/D rental book SALE PACKAGE.
 *
 *   node --env-file=.env.local scripts/wd-sale-package.mjs
 *
 * READ-ONLY: no create/update/delete anywhere. Output:
 *   ~/business-os/WD-SALE-PACKAGE.md
 *
 * Computes from real ledger rows (WdPayment), not the admin panel's
 * estimate constants (the panel's $55/$40 MRR figures are stale vs the
 * actual Stripe prices of $58/$42 — flagged in the doc).
 */

import { PrismaClient } from "@prisma/client";
import { writeFileSync } from "fs";
import { join } from "path";
import os from "os";

const prisma = new PrismaClient();

const usd = (n) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const usd2 = (n) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });
const pct = (n) => `${(n * 100).toFixed(1)}%`;

// Mirrors components/wd/admin/wd-summary-panel.tsx bundle detection.
const isBundle = (desc) => {
  const d = (desc || "").toLowerCase();
  return (
    d.includes("dryer") || d.includes("bundle") || d.includes("w&d") ||
    d.includes("w/d") || d.includes("and d")
  );
};

function trailingMonths(n) {
  const out = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}

async function main() {
  const clients = await prisma.wdClient.findMany({
    include: { payments: true },
  });
  const payments = await prisma.wdPayment.findMany();

  const active = clients.filter((c) => c.active);
  const inactive = clients.filter((c) => !c.active);

  // ── Trailing-12 revenue table ──
  const months = trailingMonths(12);
  const byMonth = new Map(months.map((m) => [m, { paid: 0, paidN: 0, missedN: 0 }]));
  for (const p of payments) {
    const row = byMonth.get(p.month);
    if (!row) continue;
    if (p.status === "paid") {
      row.paid += p.amount;
      row.paidN++;
    } else if (p.status === "missed") {
      row.missedN++;
    }
  }
  const t12Revenue = [...byMonth.values()].reduce((s, r) => s + r.paid, 0);
  const t12PaidN = [...byMonth.values()].reduce((s, r) => s + r.paidN, 0);
  const t12MissedN = [...byMonth.values()].reduce((s, r) => s + r.missedN, 0);
  const collectionRate = t12PaidN + t12MissedN > 0 ? t12PaidN / (t12PaidN + t12MissedN) : 1;

  // ── Unit breakdown + real MRR ──
  const bundles = active.filter((c) => isBundle(c.unitDescription));
  const washers = active.filter((c) => !isBundle(c.unitDescription));
  // Real MRR: each active client's most recent PAID payment amount; fall back
  // to list price by unit type ($58 bundle / $42 washer) when no payment yet.
  let mrr = 0;
  let mrrFromLedger = 0;
  for (const c of active) {
    const recent = c.payments
      .filter((p) => p.status === "paid")
      .sort((a, b) => (a.month < b.month ? 1 : -1))[0];
    if (recent) {
      mrr += recent.amount;
      mrrFromLedger++;
    } else {
      mrr += isBundle(c.unitDescription) ? 58 : 42;
    }
  }
  const onAutopay = active.filter(
    (c) => c.stripeSubscriptionId && c.subscriptionStatus === "active",
  ).length;

  // ── Churn / tenure ──
  const now = Date.now();
  const tenureMonths = (c) => {
    const start = c.installDate ?? c.createdAt;
    const end = c.active ? new Date() : c.updatedAt;
    return Math.max(0, (end.getTime() - new Date(start).getTime()) / (30.44 * 86400e3));
  };
  const avgTenureActive = active.length
    ? active.reduce((s, c) => s + tenureMonths(c), 0) / active.length
    : 0;
  const avgTenureChurned = inactive.length
    ? inactive.reduce((s, c) => s + tenureMonths(c), 0) / inactive.length
    : 0;
  const churned12 = inactive.filter(
    (c) => now - new Date(c.updatedAt).getTime() < 365 * 86400e3,
  ).length;
  const annualChurn = active.length + churned12 > 0 ? churned12 / (active.length + churned12) : 0;

  // ── Cost basis ──
  const costBasis = clients.reduce((s, c) => s + (c.unitCost || 0), 0);
  const allTimeRevenue = payments
    .filter((p) => p.status === "paid")
    .reduce((s, p) => s + p.amount, 0);

  // ── Valuation range ──
  // Route/book conventions (laundry routes, vending routes, small recurring
  // service books): 30–50x monthly net or 2.5–4x annual net. Net assumes a
  // repair + replacement reserve — modeled at 15% of revenue (buyer should
  // verify against WdRepairItem actuals).
  const repairReserve = 0.15;
  const monthlyNet = mrr * (1 - repairReserve);
  const annualNet = monthlyNet * 12;
  const valLow = monthlyNet * 30;
  const valHigh = monthlyNet * 50;

  const monthTable = months
    .map((m) => {
      const r = byMonth.get(m);
      return `| ${m} | ${usd2(r.paid)} | ${r.paidN} | ${r.missedN} |`;
    })
    .join("\n");

  const doc = `# Washer/Dryer Rental Book — Sale Package
*Generated ${new Date().toISOString().slice(0, 10)} from live ledger data (read-only). Operator: Jared Tolley, Your KC Homes LLC, Independence/KC metro, MO.*

## The asset in one paragraph
${active.length} active rental units (${bundles.length} washer+dryer bundles at $58/mo, ${washers.length} washer-only at $42/mo) producing **${usd(mrr)}/mo in recurring revenue**, ${pct(collectionRate)} trailing-12 collection rate, running on a fully automated billing stack: Stripe autopay, automated failed-payment dunning, AI-drafted customer SMS, and self-serve signup. The operator's time involvement is deliveries, installs, and occasional repairs — the money side runs itself.

## Trailing-12-month revenue (real ledger, paid rows only)
| Month | Collected | Payments | Missed |
|---|---|---|---|
${monthTable}
| **T12 total** | **${usd2(t12Revenue)}** | ${t12PaidN} | ${t12MissedN} |

Collection rate (paid ÷ attempted): **${pct(collectionRate)}**

## Unit & client roster summary
- Total clients ever: ${clients.length} · Active: ${active.length} · Churned: ${inactive.length}
- Active mix: ${bundles.length} bundles ($58) / ${washers.length} washer-only ($42)
- **MRR: ${usd(mrr)}** (${mrrFromLedger}/${active.length} computed from each client's most recent actual paid amount; remainder at list price)
- On Stripe autopay subscriptions: ${onAutopay}/${active.length} (remainder pay via payment link/manual — conversion to autopay is a buyer upside)
- Average active-client tenure: ${avgTenureActive.toFixed(1)} months
- Note: the /wd/admin panel's "monthly income" tile uses stale $55/$40 estimate constants; this document's MRR comes from the payment ledger and the real $58/$42 Stripe prices.

## Churn & retention
- Churned in last 12 months: ${churned12} (annualized churn ≈ ${pct(annualChurn)})
- Average tenure of churned clients: ${avgTenureChurned.toFixed(1)} months
- Retention driver: tenants without in-unit laundry rarely churn voluntarily — churn is mostly moves.

## Capital & cost basis
- Total unit cost basis (all units ever purchased): ${usd(costBasis)}
- All-time collected revenue: ${usd(allTimeRevenue)}
- Recovered-capital ratio: ${(allTimeRevenue / Math.max(1, costBasis)).toFixed(2)}x

## The automation stack (transfers with the business)
- **Stripe autopay** — subscriptions sync to the admin panel via webhooks; payment state is always current
- **3-stage dunning ladder** — failed payment → day-0 / day-3 / day-7 escalating drafts (proven copy), one-tap approve-send
- **AI SMS responder** — inbound customer texts get drafted replies in the operator's voice for one-tap approval
- **Self-serve signup** — tolley.io/wd checkout creates a pending client for one-click approval
- **Renewal reminders** — automated pre-charge heads-up drafts
- **Admin panel** — full client spreadsheet, payment history, KPIs, repair log, message inbox

## Valuation framework (range, not a number)
Assumes a ${pct(repairReserve)} repair/replacement reserve → monthly net ≈ ${usd(monthlyNet)}, annual net ≈ ${usd(annualNet)}. Buyer should verify reserve against the repair log.
- Route/book convention 30–50× monthly net: **${usd(valLow)} – ${usd(valHigh)}**
- Cross-check 2.5–4× annual net: ${usd(annualNet * 2.5)} – ${usd(annualNet * 4)}
- Upsides a buyer prices in: autopay conversion of remaining manual payers, the self-serve signup funnel keeps producing, and unit count can grow with used-appliance supply (~$200/unit cost basis, ~4-month payback per unit).

## What transfers at close
1. ${active.length} active client relationships (contacts, addresses, install photos/receipts stored per client)
2. Stripe subscriptions — transferred via Stripe account migration, or cancel/re-subscribe onto the buyer's Stripe (the self-serve checkout link makes re-subscription one text per client)
3. The physical units (washers/dryers in place at client homes)
4. Optional transition package: admin-panel access period + operator handoff support
5. The dunning/reminder/AI-responder copy and playbooks

---
*Numbers regenerate any time with* \`node --env-file=.env.local scripts/wd-sale-package.mjs\`
`;

  const out = join(os.homedir(), "business-os", "WD-SALE-PACKAGE.md");
  writeFileSync(out, doc);
  console.log(`✅ Wrote ${out}`);
  console.log(
    `   ${active.length} active units · MRR ${usd(mrr)} · T12 ${usd(t12Revenue)} · collection ${pct(collectionRate)} · valuation ${usd(valLow)}–${usd(valHigh)}`,
  );
}

main()
  .catch((e) => {
    console.error("Fatal:", e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
