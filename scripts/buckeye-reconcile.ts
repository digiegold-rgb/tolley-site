/**
 * Buckeye ACH reconciler.
 *
 * Buckeye pays ONE lump ACH per week into Bluevine. This matches each deposit
 * (pulled from Plaid by xero-ledger/scripts/buckeye-deposits.mjs) against the
 * currently-OPEN Buckeye invoices and:
 *   - auto-marks PAID on a confident exact match (single invoice, or one unique
 *     subset of open invoices summing to the deposit),
 *   - Telegram-flags everything ambiguous / unmatched for a one-tap human call.
 *
 * It NEVER blind-flips: ambiguous sums (multiple possible subsets) and
 * no-match deposits are flagged, not applied. Idempotent via InvoicePayment
 * .reference = Plaid transactionId, so re-runs are safe.
 *
 *   npx tsx scripts/buckeye-reconcile.ts [--dry-run] [--lookback-days 30]
 */
import { PrismaClient } from '@prisma/client';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

// ---- env (Prisma reads .env; Telegram lives in .env.local) ----
function loadEnvFile(p: string) {
  if (!existsSync(p)) return;
  for (const raw of readFileSync(p, 'utf8').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
    if (!(key in process.env)) process.env[key] = val;
  }
}
loadEnvFile(join(process.cwd(), '.env.local'));
loadEnvFile(join(process.cwd(), '.env'));

const DRY = process.argv.includes('--dry-run');
const lookbackArg = process.argv.indexOf('--lookback-days');
const LOOKBACK_DAYS = lookbackArg !== -1 ? Number(process.argv[lookbackArg + 1]) : 35;
const MAX_SUBSET = 5; // auto-apply only unique subsets up to this size; larger = flag

const DEPOSITS_FILE = '/home/jelly/xero-ledger/data/plaid/buckeye-deposits.json';
const STATE_FILE = '/home/jelly/xero-ledger/data/plaid/buckeye-reconcile-state.json';

const prisma = new PrismaClient();
const log = (...a: unknown[]) => console.log('[buckeye-reconcile]', ...a);
const cents = (n: number) => Math.round(n * 100);
const fmt = (n: number) => `$${n.toFixed(2)}`;

interface Deposit { transactionId: string; date: string; amount: number; name: string }
interface OpenInv { id: string; number: string; total: number; sentAt: Date | null; createdAt: Date }

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

/** All exact-sum subsets (by cents) of the eligible invoices. */
function exactSubsets(targetCents: number, items: OpenInv[]): OpenInv[][] {
  const out: OpenInv[][] = [];
  const rec = (i: number, remaining: number, acc: OpenInv[]) => {
    if (remaining === 0 && acc.length) { out.push([...acc]); return; }
    if (remaining < 0 || i >= items.length || out.length > 20) return;
    rec(i + 1, remaining - cents(items[i].total), [...acc, items[i]]); // take
    rec(i + 1, remaining, acc);                                        // skip
  };
  rec(0, targetCents, []);
  return out;
}

/** Subset whose sum is closest to (but for our use, <= reasonably near) target. */
function closestSubset(targetCents: number, items: OpenInv[]): { set: OpenInv[]; sumCents: number } | null {
  let best: { set: OpenInv[]; sumCents: number } | null = null;
  let calls = 0;
  const rec = (i: number, sum: number, acc: OpenInv[]) => {
    if (++calls > 50000) return;
    if (acc.length) {
      const diff = Math.abs(targetCents - sum);
      if (!best || diff < Math.abs(targetCents - best.sumCents)) best = { set: [...acc], sumCents: sum };
    }
    if (i >= items.length) return;
    rec(i + 1, sum + cents(items[i].total), [...acc, items[i]]);
    rec(i + 1, sum, acc);
  };
  rec(0, 0, []);
  return best;
}

async function main() {
  if (!existsSync(DEPOSITS_FILE)) { log('No deposits feed at', DEPOSITS_FILE, '— run xero-ledger/scripts/buckeye-deposits.mjs first'); process.exit(1); }
  const deposits: Deposit[] = JSON.parse(readFileSync(DEPOSITS_FILE, 'utf8')).deposits || [];
  const state: { matched: string[]; flagged: string[] } =
    existsSync(STATE_FILE) ? JSON.parse(readFileSync(STATE_FILE, 'utf8')) : { matched: [], flagged: [] };

  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - LOOKBACK_DAYS);

  // Already-applied deposits (idempotency): InvoicePayment.reference = transactionId
  const appliedRefs = new Set(
    (await prisma.invoicePayment.findMany({ where: { method: 'ach' }, select: { reference: true } }))
      .map((r) => r.reference).filter(Boolean) as string[]
  );

  const flags: string[] = [];
  let appliedCount = 0;

  // process oldest→newest so earlier weeks clear before later ones
  for (const dep of deposits) {
    if (appliedRefs.has(dep.transactionId) || state.matched.includes(dep.transactionId)) continue;
    if (new Date(dep.date) < cutoff) continue; // ignore ancient deposits (already hand-reconciled)

    // reload open invoices each iteration (a prior deposit may have closed some)
    const open: OpenInv[] = (await prisma.invoice.findMany({
      where: { status: 'SENT', contact: { email: { contains: 'buckeye', mode: 'insensitive' } } },
      select: { id: true, invoiceNumber: true, total: true, sentAt: true, createdAt: true },
    })).map((i) => ({ id: i.id, number: i.invoiceNumber, total: i.total, sentAt: i.sentAt, createdAt: i.createdAt }));

    // eligible = sent on/before the deposit date (+2 day grace for posting lag)
    const grace = new Date(dep.date); grace.setDate(grace.getDate() + 2);
    const eligible = open.filter((i) => (i.sentAt ?? i.createdAt) <= grace);

    const subsets = exactSubsets(cents(dep.amount), eligible);

    if (subsets.length === 1 && subsets[0].length <= MAX_SUBSET) {
      // confident — apply
      const set = subsets[0];
      log(`MATCH ${dep.date} ${fmt(dep.amount)} → ${set.map((s) => s.number).join(' + ')}`);
      if (!DRY) {
        for (const inv of set) {
          await prisma.invoicePayment.create({
            data: { invoiceId: inv.id, amount: inv.total, method: 'ach',
              reference: dep.transactionId, notes: `Buckeye ACH ${dep.date} (lump ${fmt(dep.amount)})` },
          });
          await prisma.invoice.update({
            where: { id: inv.id },
            data: { amountPaid: inv.total, amountDue: 0, status: 'PAID', paidAt: new Date(dep.date + 'T12:00:00Z') },
          });
        }
        state.matched.push(dep.transactionId);
      }
      appliedCount += set.length;
    } else if (subsets.length === 0) {
      // No open-invoice subset. Before flagging, see if this deposit exactly
      // settles an already-PAID Buckeye invoice that was never linked to an ACH
      // (e.g. hand-marked). If so, backfill the payment record silently.
      const paidUnlinked = await prisma.invoice.findFirst({
        where: {
          status: 'PAID',
          contact: { email: { contains: 'buckeye', mode: 'insensitive' } },
          total: dep.amount,
          payments: { none: { method: 'ach', reference: dep.transactionId } },
        },
        select: { id: true, invoiceNumber: true, total: true },
      });
      if (paidUnlinked) {
        log(`LINK ${dep.date} ${fmt(dep.amount)} → ${paidUnlinked.invoiceNumber} (already PAID, backfilling ACH record)`);
        if (!DRY) {
          await prisma.invoicePayment.create({
            data: { invoiceId: paidUnlinked.id, amount: paidUnlinked.total, method: 'ach',
              reference: dep.transactionId, notes: `Buckeye ACH ${dep.date} (backfill link)` },
          });
          state.matched.push(dep.transactionId);
        }
        continue;
      }
      // genuinely unmatched — flag once, with the closest combo + gap
      if (state.flagged.includes(dep.transactionId)) continue;
      const near = closestSubset(cents(dep.amount), eligible);
      let reason: string;
      if (near) {
        const gap = (cents(dep.amount) - near.sumCents) / 100; // deposit − combo
        const dir = gap < 0 ? `Buckeye paid ${fmt(Math.abs(gap))} LESS` : `Buckeye paid ${fmt(Math.abs(gap))} MORE`;
        reason = `closest: ${near.set.map((s) => s.number).join('+')} = ${fmt(near.sumCents / 100)} → ${dir} than this combo (short-pay / rate diff?)`;
      } else {
        reason = eligible.length ? `open: ${eligible.map((e) => e.number).join(', ')}` : 'no open invoices in window';
      }
      flags.push(`⚠️ ${dep.date} *${fmt(dep.amount)}* Buckeye ACH: ${reason}`);
      if (!DRY) state.flagged.push(dep.transactionId);
    } else {
      // ambiguous (multiple exact subsets) or oversized unique subset — flag once
      if (state.flagged.includes(dep.transactionId)) continue;
      let reason: string;
      if (subsets.length > 1) {
        reason = `${subsets.length} possible combos — needs you to pick:\n` +
          subsets.slice(0, 4).map((s) => `   • ${s.map((x) => x.number).join('+')}`).join('\n');
      } else {
        reason = `unique combo too large (${subsets[0].length} invoices) — confirm: ${subsets[0].map((x) => x.number).join('+')}`;
      }
      flags.push(`⚠️ ${dep.date} *${fmt(dep.amount)}* Buckeye ACH: ${reason}`);
      if (!DRY) state.flagged.push(dep.transactionId);
    }
  }

  // remaining open invoices, for context
  const stillOpen = await prisma.invoice.findMany({
    where: { status: 'SENT', contact: { email: { contains: 'buckeye', mode: 'insensitive' } } },
    select: { invoiceNumber: true, total: true }, orderBy: { createdAt: 'asc' },
  });

  if (!DRY) writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));

  log(`Applied ${appliedCount} invoice(s); ${flags.length} flag(s); ${stillOpen.length} still open`);

  if (flags.length || appliedCount) {
    const lines = ['*🧾 Buckeye reconcile*'];
    if (appliedCount) lines.push(`✅ Auto-marked ${appliedCount} invoice(s) PAID from matched ACH`);
    if (flags.length) lines.push('', ...flags);
    if (stillOpen.length) lines.push('', `*Still open:* ${stillOpen.map((s) => `${s.invoiceNumber}(${fmt(s.total)})`).join(', ')}`);
    if (DRY) lines.push('', '_(dry-run — nothing written)_');
    if (DRY) console.log('\n' + lines.join('\n'));
    else await notify(lines.join('\n'));
  } else {
    log('Nothing to do.');
  }

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
