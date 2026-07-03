/**
 * Stripe → invoice reconciler (account invoices paid via Stripe payment links).
 *
 * Belt-and-suspenders backstop for the webhook: walks every invoice that has a
 * stripePaymentLinkId, queries Stripe for COMPLETED checkout sessions on that
 * link, and:
 *   - records each captured payment as an InvoicePayment (idempotent on the
 *     payment_intent id) and marks the invoice PAID,
 *   - flags DUPLICATE / OVERPAY (more than one paid session, or paid > total)
 *     to Telegram for a human to refund-or-credit.
 *
 * Catches anything the webhook missed (e.g. links created before the
 * payment_intent_data.metadata fix). Safe to run repeatedly.
 *
 *   npx tsx scripts/stripe-invoice-reconcile.ts [--dry-run]
 */
import { PrismaClient } from '@prisma/client';
import Stripe from 'stripe';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const ACK_FILE = '/home/jelly/xero-ledger/data/stripe-reconcile-ack.json';

function loadEnvFile(p: string) {
  if (!existsSync(p)) return;
  for (const raw of readFileSync(p, 'utf8').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('='); if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
    if (!(key in process.env)) process.env[key] = val;
  }
}
loadEnvFile(join(process.cwd(), '.env.local'));
loadEnvFile(join(process.cwd(), '.env'));
loadEnvFile('/home/jelly/xero-ledger/.env'); // STRIPE_SECRET_KEY / TELEGRAM fallback (live key lives here)

const DRY = process.argv.includes('--dry-run');
const prisma = new PrismaClient();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);
const log = (...a: unknown[]) => console.log('[stripe-reconcile]', ...a);
const fmt = (n: number) => `$${n.toFixed(2)}`;

async function notify(text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN, chat = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chat) { log('Telegram creds missing; skipping notify'); return; }
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chat, text, parse_mode: 'Markdown', disable_web_page_preview: true }),
    });
  } catch (e) { log('notify failed:', e); }
}

async function main() {
  const invoices = await prisma.invoice.findMany({
    where: { stripePaymentLinkId: { not: null } },
    include: { payments: true, contact: true },
  });
  log(`${invoices.length} invoices have a Stripe payment link`);

  const ack: { acked: string[] } = existsSync(ACK_FILE) ? JSON.parse(readFileSync(ACK_FILE, 'utf8')) : { acked: [] };
  const flags: string[] = [];
  let markedPaid = 0, recorded = 0;

  for (const inv of invoices) {
    const total = (inv as { total: number }).total;
    // all completed+paid checkout sessions for this link
    const sessions = await stripe.checkout.sessions.list({ payment_link: inv.stripePaymentLinkId as string, limit: 20 });
    const paid = sessions.data.filter((s) => s.status === 'complete' && s.payment_status === 'paid' && s.payment_intent);
    if (!paid.length) continue;

    let invoicePaidTotal = 0;
    for (const s of paid) {
      const pi = String(s.payment_intent);
      const amount = (s.amount_total ?? 0) / 100;
      invoicePaidTotal += amount;
      const already = inv.payments.some((p) => p.reference === pi)
        || (await prisma.invoicePayment.findFirst({ where: { reference: pi, method: 'stripe' }, select: { id: true } }));
      if (already) continue;
      log(`${inv.invoiceNumber}: record ${pi} ${fmt(amount)}`);
      if (!DRY) {
        await prisma.invoicePayment.create({
          data: { invoiceId: inv.id, amount, method: 'stripe', reference: pi, notes: `Stripe session ${s.id} (sweep)` },
        });
      }
      recorded++;
    }

    // mark PAID if not already
    if (inv.status !== 'PAID') {
      log(`${inv.invoiceNumber}: → PAID`);
      if (!DRY) {
        await prisma.invoice.update({
          where: { id: inv.id },
          data: { status: 'PAID', amountPaid: total, amountDue: 0, paidAt: new Date((paid[0].created ?? 0) * 1000) },
        });
      }
      markedPaid++;
    }

    // duplicate / overpay detection — flag once, then remember it was acknowledged
    if ((paid.length > 1 || invoicePaidTotal > total + 0.01) && !ack.acked.includes(inv.invoiceNumber)) {
      flags.push(`⚠️ ${inv.invoiceNumber} (${inv.contact?.name ?? '?'}): ${paid.length} paid sessions = ${fmt(invoicePaidTotal)} on a ${fmt(total)} invoice — overpaid ${fmt(invoicePaidTotal - total)} (refund or credit?)`);
      if (!DRY) ack.acked.push(inv.invoiceNumber);
    }
  }

  if (!DRY) writeFileSync(ACK_FILE, JSON.stringify(ack, null, 2));
  log(`Marked ${markedPaid} PAID, recorded ${recorded} payment(s), ${flags.length} overpay flag(s)`);
  if (flags.length) {
    const msg = ['*💳 Stripe invoice reconcile — overpayments*', '', ...flags].join('\n') + (DRY ? '\n\n_(dry-run)_' : '');
    if (DRY) console.log('\n' + msg); else await notify(msg);
  }
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
