/**
 * One-time backfill: rename 5 post-Xero Buckeye invoices so invoiceNumber
 * matches the customer-facing Reference (continuing the Xero INV-141 series).
 *
 * Also reconciles INV-144 (was INV-0148) which is PAID per status but has
 * no InvoicePayment row and amountPaid/Due drift.
 *
 * Writes a JSON snapshot of pre-state to the shared folder before changes.
 *
 * Usage:
 *   npx tsx scripts/buckeye-rename.ts          # dry-run
 *   npx tsx scripts/buckeye-rename.ts --apply  # write
 */
import { PrismaClient } from '@prisma/client';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');
const SNAP_DIR = '/home/jelly/Shared/Buckeye-2026-05-12';

const renames = [
  { from: 'INV-0142', to: 'INV-142' },
  { from: 'INV-0143', to: 'INV-143' },
  { from: 'INV-0148', to: 'INV-144' },
  { from: 'INV-0152', to: 'INV-145' },
  { from: 'INV-0156', to: 'INV-146' },
];

async function main() {
  // 1. Snapshot
  const snapshots: any[] = [];
  for (const r of renames) {
    const inv = await prisma.invoice.findUnique({
      where: { invoiceNumber: r.from },
      include: { lineItems: true, payments: true, attachments: true, contact: true },
    });
    if (!inv) throw new Error(`Missing invoice ${r.from}`);
    snapshots.push({ rename: r, original: inv });

    // collision guard
    const collide = await prisma.invoice.findUnique({ where: { invoiceNumber: r.to } });
    if (collide) throw new Error(`Target ${r.to} collides with ${collide.id}`);
  }

  mkdirSync(SNAP_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const snapPath = join(SNAP_DIR, `pre-rename-snapshot-${stamp}.json`);
  writeFileSync(snapPath, JSON.stringify(snapshots, null, 2));
  console.log(`Snapshot: ${snapPath}`);

  if (!APPLY) {
    console.log('\nDRY-RUN — pass --apply to write. Planned changes:');
    for (const r of renames) console.log(`  ${r.from.padEnd(10)} → ${r.to}`);
    console.log('\nAlso: create InvoicePayment $95.20 for INV-144 (was INV-0148) and set amountPaid=95.20, amountDue=0.');
    return;
  }

  // 2. Apply renames in a single transaction
  await prisma.$transaction(async (tx) => {
    for (const r of renames) {
      const upd = await tx.invoice.update({
        where: { invoiceNumber: r.from },
        data: { invoiceNumber: r.to },
        select: { id: true, invoiceNumber: true, status: true, total: true },
      });
      console.log(`  renamed → ${upd.invoiceNumber} (${upd.id}, ${upd.status}, $${upd.total})`);
    }

    // 3. Reconcile INV-144 paid state
    const inv144 = await tx.invoice.findUnique({
      where: { invoiceNumber: 'INV-144' },
      select: { id: true, total: true, amountPaid: true, amountDue: true, status: true, payments: { select: { id: true } } },
    });
    if (!inv144) throw new Error('INV-144 missing after rename');
    if (inv144.status === 'PAID' && inv144.amountPaid === 0 && inv144.payments.length === 0) {
      await tx.invoicePayment.create({
        data: {
          invoiceId: inv144.id,
          amount: inv144.total,
          paidAt: new Date('2026-04-29'),
          method: 'ACH',
          reference: 'Buckeye ACH — reconciled post-rename (was INV-0148)',
        },
      });
      await tx.invoice.update({
        where: { id: inv144.id },
        data: {
          amountPaid: inv144.total,
          amountDue: 0,
          paidAt: new Date('2026-04-29'),
        },
      });
      console.log(`  reconciled INV-144 payment ($${inv144.total})`);
    } else {
      console.log(`  INV-144 already reconciled, skipping payment row`);
    }
  });

  console.log('\nDONE');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
