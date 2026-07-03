/**
 * One-off resend for Wayne Clark / Aramsco outstanding invoices.
 * Generates a FRESH Stripe payment link (with the payment_intent_data.metadata
 * fix so the webhook auto-records) and re-sends via the authenticated
 * jared@yourkchomes.com SMTP path. Run AFTER the metadata fix is deployed.
 *
 *   (EMAIL_* sourced from Vercel prod env by the wrapper)
 *   npx tsx scripts/resend-wayne.ts INV-0155 INV-0145
 */
import { readFileSync, existsSync } from 'fs';

// STRIPE_SECRET_KEY lives in xero-ledger/.env; EMAIL_* are exported by the wrapper.
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
loadEnvFile('/home/jelly/xero-ledger/.env');

import { PrismaClient } from '@prisma/client';
import { createInvoicePaymentLink } from '@/lib/account/stripe-payment-link';
import { sendInvoiceEmail } from '@/lib/account/invoice-email';

const prisma = new PrismaClient();
const targets = process.argv.slice(2).filter((a) => a.startsWith('INV-'));

async function main() {
  if (!process.env.EMAIL_SERVER_PASSWORD) { console.error('EMAIL_SERVER_PASSWORD not in env — wrapper must source Vercel prod env'); process.exit(1); }
  if (!targets.length) { console.error('No INV- targets passed'); process.exit(1); }

  for (const num of targets) {
    const inv = await prisma.invoice.findFirst({
      where: { invoiceNumber: num },
      include: { contact: { select: { name: true, email: true } }, lineItems: true, _count: { select: { attachments: true } } },
    });
    if (!inv) { console.log(`${num}: NOT FOUND`); continue; }
    if (inv.status === 'PAID' || inv.status === 'VOID') { console.log(`${num}: status ${inv.status} — skipping`); continue; }
    if (!inv.contact?.email) { console.log(`${num}: no contact email — skipping`); continue; }

    // fresh link with the metadata fix
    const link = await createInvoicePaymentLink({ id: inv.id, total: inv.total, invoiceNumber: inv.invoiceNumber, contact: inv.contact });
    await prisma.invoice.update({ where: { id: inv.id }, data: { stripePaymentLinkId: link.paymentLinkId, stripePaymentLinkUrl: link.paymentLinkUrl } });

    await sendInvoiceEmail({
      to: inv.contact.email,
      contactName: inv.contact.name || null,
      invoiceNumber: inv.invoiceNumber,
      issueDate: inv.issueDate,
      dueDate: inv.dueDate,
      lineItems: inv.lineItems.map((li) => ({ description: li.description, quantity: li.quantity, unitAmount: li.unitAmount, lineAmount: li.lineAmount })),
      subTotal: inv.subTotal,
      total: inv.total,
      amountDue: inv.amountDue,
      notes: inv.notes,
      paymentLinkUrl: link.paymentLinkUrl,
      attachmentCount: inv._count.attachments,
    });

    await prisma.invoice.update({ where: { id: inv.id }, data: { status: inv.status === 'OVERDUE' ? 'OVERDUE' : 'SENT', sentAt: new Date() } });
    console.log(`✅ ${num} ($${inv.total}) resent to ${inv.contact.email} — fresh link ${link.paymentLinkId}`);
  }
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
