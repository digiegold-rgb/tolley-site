/**
 * W/D rental repo packets: one printable PDF per delinquent customer with the
 * authoritative Stripe payment record (payments made, card last4, failed
 * attempts, payments behind, $ to be current).
 *
 * Read-only against Stripe — list calls only, no writes.
 *
 *   node scripts/wd-repo-packet.mjs
 */
import { chromium } from 'playwright';
import { PDFDocument } from 'pdf-lib';
import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

// ---- env (chain matches stripe-invoice-reconcile.ts) ----
const XERO_ENV = '/home/jelly/xero-ledger/.env';
function loadEnvFile(path) {
  try {
    for (const line of readFileSync(path, 'utf8').split('\n')) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  } catch {}
}
loadEnvFile(XERO_ENV);
const STRIPE_KEY = process.env.STRIPE_SECRET_KEY;
if (!STRIPE_KEY) { console.error('No STRIPE_SECRET_KEY'); process.exit(1); }

const OUT_DIR = `/home/jelly/business-os/wd-repo-packets/${new Date().toISOString().slice(0, 10)}`;
const REVIEW_DIR = '/home/jelly/growth-engine/shorts/review/wd-repo-packets';

const TARGETS = [
  { name: 'Eric Jones',   email: 'ericj020893@gmail.com',    phone: '8168537329', address: '7415 Wabash Ave, Kansas City, MO', claimedStart: '9/27/25' },
  { name: 'Tae (Tavea Horn)', email: 'taveahorn1@icloud.com', phone: '9132013021', address: '18949 East Tepee Court, Independence, MO', claimedStart: '11/22/25' },
  { name: 'Jamesha W',    email: 'kpossible30@icloud.com',   phone: '8169773635', address: '11021 Bristol Terr', claimedStart: '9/25/25' },
  { name: 'Richard Rock', email: 'rockrichardj@gmail.com',   phone: '4795338665', address: '134 East Culton Street Apt B, Warrensburg, MO 64093', claimedStart: '05/06/26' },
  { name: 'Jamesha H',    email: 'jameshahughes4@gmail.com', phone: '8166144072', address: '8649 Sleepy Hollow, Kansas City, MO', claimedStart: '9/23/25' },
];

// ---- stripe (raw REST, read-only) ----
async function stripeGet(path, params = {}) {
  const url = new URL(`https://api.stripe.com/v1/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url, { headers: { Authorization: `Bearer ${STRIPE_KEY}` } });
  const body = await res.json();
  if (!res.ok) throw new Error(`Stripe ${path}: ${body.error?.message || res.status}`);
  return body;
}

async function listAll(path, params = {}) {
  const out = [];
  let starting_after;
  for (;;) {
    const page = await stripeGet(path, { ...params, limit: '100', ...(starting_after ? { starting_after } : {}) });
    out.push(...page.data);
    if (!page.has_more) return out;
    starting_after = out[out.length - 1].id;
  }
}

const digits = (s) => (s || '').replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '');

// ---- formatting ----
const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const usd = (cents) => fmt.format(cents / 100);
const dateFmt = (unix) => new Date(unix * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const esc = (s) => (s ?? '').toString().replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const PM_LABELS = { cashapp: 'Cash App Pay (via Stripe)', link: 'Link (via Stripe)', us_bank_account: 'Bank account (ACH via Stripe)' };
function cardLabel(pmd) {
  const c = pmd?.card;
  if (!c) return PM_LABELS[pmd?.type] || pmd?.type || '—';
  const brand = (c.brand || 'card').replace(/^\w/, (ch) => ch.toUpperCase());
  return `${brand} •••• ${c.last4}`;
}

function monthsBetween(fromUnix, to = new Date()) {
  const from = new Date(fromUnix * 1000);
  let m = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
  if (to.getDate() >= from.getDate()) m += 1; // current cycle has started
  return Math.max(m, 1);
}

function html(t, d) {
  const payRows = d.paid.map((c, i) => `
    <tr>
      <td style="padding:6px 8px;border-bottom:1px solid #e5e5e5;">${i + 1}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #e5e5e5;">${dateFmt(c.created)}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #e5e5e5;text-align:right;">${usd(c.amount)}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #e5e5e5;">${esc(cardLabel(c.payment_method_details))}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #e5e5e5;color:#059669;font-weight:600;">Paid</td>
    </tr>`).join('');

  const failShown = d.failed.slice(-12);
  const failEarlier = d.failed.length - failShown.length;
  const failRows = failShown.map((c) => `
    <tr>
      <td style="padding:6px 8px;border-bottom:1px solid #e5e5e5;">${dateFmt(c.created)}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #e5e5e5;text-align:right;">${usd(c.amount)}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #e5e5e5;">${esc(cardLabel(c.payment_method_details))}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #e5e5e5;color:#dc2626;">${esc(c.failure_message || c.outcome?.seller_message || 'Declined')}</td>
    </tr>`).join('');

  return `<!doctype html>
<html><head><meta charset="utf-8"><title>${esc(t.name)} — Payment Record</title></head>
<body style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#111;line-height:1.45;font-size:13px;">
<div style="max-width:760px;margin:0 auto;padding:34px 40px;">

  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:22px;">
    <div>
      <h1 style="font-size:20px;font-weight:700;margin:0;">Your KC Homes LLC</h1>
      <p style="color:#666;font-size:12px;margin:3px 0 0;">Washer/Dryer Rental Program · Independence, MO · tolley.io</p>
    </div>
    <div style="text-align:right;">
      <h2 style="font-size:17px;font-weight:700;margin:0;color:#b91c1c;">PAYMENT RECORD &amp; ACCOUNT STATUS</h2>
      <p style="color:#666;font-size:11px;margin:4px 0 0;">Generated ${new Date().toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' })}</p>
    </div>
  </div>

  <div style="display:flex;gap:24px;margin-bottom:18px;padding:12px 14px;background:#f8f8f8;border-radius:8px;">
    <div style="flex:1;">
      <p style="font-size:10px;text-transform:uppercase;color:#999;margin:0 0 3px;letter-spacing:.5px;">Customer</p>
      <p style="font-weight:700;font-size:15px;margin:0;">${esc(t.name)}</p>
      <p style="margin:2px 0 0;color:#444;">${esc(t.address)}</p>
      <p style="margin:2px 0 0;color:#444;">${esc(t.phoneDisplay)} · ${esc(t.email)}</p>
    </div>
    <div style="text-align:right;">
      <p style="font-size:10px;text-transform:uppercase;color:#999;margin:0 0 3px;letter-spacing:.5px;">Rental</p>
      <p style="margin:0;"><strong>Started:</strong> ${d.startDisplay}</p>
      <p style="margin:2px 0 0;"><strong>Monthly rate:</strong> ${usd(d.rate)}</p>
      <p style="margin:2px 0 0;"><strong>Total paid to date:</strong> ${usd(d.totalPaid)}</p>
      <p style="margin:2px 0 0;"><strong>Account status:</strong> <span style="color:#b91c1c;font-weight:700;">${esc(d.statusLabel)}</span></p>
    </div>
  </div>

  <div style="display:flex;gap:10px;margin-bottom:22px;">
    ${[
      ['Payments made', String(d.paid.length), '#059669'],
      ['Payments behind', String(d.behind), '#b91c1c'],
      ['Owed to be current', usd(d.owed), '#b91c1c'],
      ['Failed attempts', String(d.failed.length), '#d97706'],
    ].map(([label, val, color]) => `
    <div style="flex:1;border:2px solid ${color};border-radius:8px;padding:10px 12px;text-align:center;">
      <div style="font-size:24px;font-weight:800;color:${color};">${val}</div>
      <div style="font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:#666;margin-top:2px;">${label}</div>
    </div>`).join('')}
  </div>

  <h3 style="font-size:13px;margin:0 0 6px;border-bottom:2px solid #111;padding-bottom:4px;">Payments received (${d.paid.length})</h3>
  <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
    <thead><tr style="background:#f3f3f3;">
      <th style="text-align:left;padding:6px 8px;font-size:10px;text-transform:uppercase;color:#666;width:30px;">#</th>
      <th style="text-align:left;padding:6px 8px;font-size:10px;text-transform:uppercase;color:#666;">Date</th>
      <th style="text-align:right;padding:6px 8px;font-size:10px;text-transform:uppercase;color:#666;">Amount</th>
      <th style="text-align:left;padding:6px 8px;font-size:10px;text-transform:uppercase;color:#666;">Card used</th>
      <th style="text-align:left;padding:6px 8px;font-size:10px;text-transform:uppercase;color:#666;">Status</th>
    </tr></thead>
    <tbody>${payRows || '<tr><td colspan="5" style="padding:10px;color:#999;">No successful payments on record.</td></tr>'}</tbody>
  </table>

  ${d.failed.length ? `
  <h3 style="font-size:13px;margin:0 0 6px;border-bottom:2px solid #111;padding-bottom:4px;">Failed / declined payment attempts (${d.failed.length} total${failEarlier ? `, ${failShown.length} most recent shown` : ''})</h3>
  <table style="width:100%;border-collapse:collapse;margin-bottom:6px;">
    <thead><tr style="background:#f3f3f3;">
      <th style="text-align:left;padding:6px 8px;font-size:10px;text-transform:uppercase;color:#666;">Date</th>
      <th style="text-align:right;padding:6px 8px;font-size:10px;text-transform:uppercase;color:#666;">Amount</th>
      <th style="text-align:left;padding:6px 8px;font-size:10px;text-transform:uppercase;color:#666;">Card</th>
      <th style="text-align:left;padding:6px 8px;font-size:10px;text-transform:uppercase;color:#666;">Reason</th>
    </tr></thead>
    <tbody>${failRows}</tbody>
  </table>
  ${failEarlier ? `<p style="margin:0 0 14px;font-size:11px;color:#666;">…plus ${failEarlier} earlier failed attempt${failEarlier === 1 ? '' : 's'}, all declined by the card issuer.</p>` : '<div style="margin-bottom:14px;"></div>'}` : ''}

  <div style="border:2px solid #111;border-radius:8px;padding:14px 16px;margin-bottom:16px;background:#fffbeb;">
    <p style="margin:0;font-weight:700;font-size:14px;">To keep the units, this account must be brought current: <span style="color:#b91c1c;">${usd(d.owed)}</span>.</p>
    <p style="margin:6px 0 0;font-size:12.5px;">How this is calculated: ${d.cycles} month${d.cycles === 1 ? '' : 's'} of rental at ${usd(d.rate)}/month = ${usd(d.cycles * d.rate)}, minus ${usd(d.totalPaid)} received = <strong>${usd(d.owed)} owed</strong> (equivalent to ${d.behind} monthly payment${d.behind === 1 ? '' : 's'}).</p>
    <p style="margin:6px 0 0;">If payment in full is not possible at the time of this visit, the washer and dryer will be retrieved. Removal takes approximately 15 minutes.</p>
  </div>

  <p style="font-size:11px;color:#555;margin:0;">
    Every valid payment on this account is processed through Stripe and is listed above in full — this record is complete.
    <strong>Payments sent directly outside of Stripe — cash, personal PayPal, Venmo, or Cash App transfers, Zelle, or payments claimed by text message — are not accepted and are not recorded on this account.</strong>
    Any payment not shown above was not received by Your KC Homes LLC.
  </p>

</div></body></html>`;
}

// ---- main ----
async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  mkdirSync(REVIEW_DIR, { recursive: true });

  console.log('Fetching all Stripe customers + charges…');
  const [customers, allCharges] = await Promise.all([listAll('customers'), listAll('charges')]);
  console.log(`  ${customers.length} customers, ${allCharges.length} charges`);

  const browser = await chromium.launch();
  const page = await (await browser.newContext()).newPage();
  const summary = [];
  const pdfPaths = [];

  for (const t of TARGETS) {
    t.phoneDisplay = t.phone.replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3');
    const emailLc = t.email.toLowerCase();

    // Union of every customer id tied to this person: customer email/phone
    // match OR any charge whose billing email matches (dupes are common —
    // checkout re-created customers, and some records carry no email at all).
    const custIds = new Set();
    for (const c of customers) {
      if ((c.email || '').toLowerCase() === emailLc || (t.phone && digits(c.phone) === t.phone)) custIds.add(c.id);
    }
    for (const c of allCharges) {
      const em = (c.billing_details?.email || c.receipt_email || '').toLowerCase();
      if (em === emailLc && c.customer) custIds.add(c.customer);
    }
    if (!custIds.size) {
      console.error(`\n❌ NOT FOUND IN STRIPE: ${t.name} <${t.email}> / ${t.phoneDisplay}`);
      summary.push({ name: t.name, found: false });
      continue;
    }

    const charges = allCharges.filter((c) => custIds.has(c.customer));
    const perCust = await Promise.all([...custIds].flatMap((id) => [
      listAll('invoices', { customer: id }),
      listAll('subscriptions', { customer: id, status: 'all' }),
    ]));
    const invoices = perCust.filter((_, i) => i % 2 === 0).flat();
    const subs = perCust.filter((_, i) => i % 2 === 1).flat();

    const paid = charges.filter((c) => c.paid && c.status === 'succeeded' && !c.refunded).sort((a, b) => a.created - b.created);
    const failed = charges.filter((c) => c.status === 'failed').sort((a, b) => a.created - b.created);

    // rate: the contractual monthly plan amount. Prefer the delinquent/active
    // monthly sub over canceled or weekly payment-plan subs; never derive from
    // charge amounts (those include late-fee and partial catch-up amounts).
    const monthlySubs = subs.filter((s) => s.items?.data?.[0]?.plan?.interval === 'month');
    const rateSub = monthlySubs.find((s) => ['unpaid', 'past_due', 'active'].includes(s.status))
      || monthlySubs.sort((a, b) => b.created - a.created)[0];
    const rate = rateSub?.items?.data?.[0]?.plan?.amount || 5800;

    // start of possession: earliest subscription (else earliest charge)
    const firstUnix = Math.min(
      ...(subs.length ? subs.map((s) => s.created) : charges.map((c) => c.created)),
    );
    const cycles = monthsBetween(firstUnix);

    // Arrears in DOLLARS: months of possession × monthly rate, minus every
    // dollar actually collected. Handles partial payments and the odd weekly
    // payment-plan stretch; slightly conservative (ignores billed late fees).
    const totalPaidCents = paid.reduce((s, c) => s + c.amount, 0);
    const owed = Math.max(cycles * rate - totalPaidCents, 0);
    const behind = Math.ceil(owed / rate);

    const latestSub = subs.sort((a, b) => b.created - a.created)[0];
    const subStatus = rateSub?.status || latestSub?.status || 'none';
    const statusLabel = { active: 'ACTIVE — PAST DUE ON PAYMENTS', past_due: 'PAST DUE', unpaid: 'UNPAID', canceled: 'DELINQUENT (subscription canceled for non-payment)' }[subStatus] || subStatus.toUpperCase();

    const d = {
      paid, failed, rate, behind, owed, statusLabel, cycles,
      totalPaid: totalPaidCents,
      startDisplay: `${dateFmt(firstUnix)} (billing began)`,
    };

    await page.setContent(html(t, d), { waitUntil: 'load' });
    await page.emulateMedia({ media: 'print' });
    const safeName = t.name.replace(/[^a-zA-Z0-9]+/g, '-');
    const pdfPath = join(OUT_DIR, `${safeName}-${t.phone.slice(-4)}.pdf`);
    await page.pdf({ path: pdfPath, format: 'Letter', printBackground: true, margin: { top: '0.4in', bottom: '0.4in', left: '0.4in', right: '0.4in' } });
    pdfPaths.push(pdfPath);

    summary.push({
      name: t.name, found: true, stripeCustomers: [...custIds],
      billingBegan: dateFmt(firstUnix), rate: rate / 100, paymentsMade: paid.length,
      totalPaid: totalPaidCents / 100,
      cyclesElapsed: cycles, paymentsBehind: behind, owedToBeCurrent: owed / 100,
      failedAttempts: failed.length, subStatus,
    });
    console.log(`✅ ${t.name}: ${paid.length} paid, ${behind} behind, owes ${usd(owed)} (${[...custIds].join('+')}, sub ${subStatus})`);
  }

  await browser.close();

  // combined PDF
  if (pdfPaths.length) {
    const merged = await PDFDocument.create();
    for (const p of pdfPaths) {
      const doc = await PDFDocument.load(readFileSync(p));
      (await merged.copyPages(doc, doc.getPageIndices())).forEach((pg) => merged.addPage(pg));
    }
    writeFileSync(join(OUT_DIR, 'ALL-COMBINED.pdf'), await merged.save());
  }

  writeFileSync(join(OUT_DIR, 'summary.json'), JSON.stringify(summary, null, 2));
  console.log(`\nOutput: ${OUT_DIR}`);
  console.table(summary.map(({ name, found, paymentsMade, paymentsBehind, owedToBeCurrent, subStatus }) =>
    ({ name, found, paymentsMade, paymentsBehind, owedToBeCurrent, subStatus })));
}

main().catch((e) => { console.error(e); process.exit(1); });
