// Deactivate Stripe payment links that should no longer accept money:
// every invoice that is PAID or VOID (or has nothing due) but still carries a
// stripePaymentLinkId. Links minted before the completed_sessions limit
// (2026-07-27) stay active forever — the hole behind Wayne Clark's double
// charges. Safe to re-run; already-inactive links are skipped by Stripe.
import { PrismaClient } from '@prisma/client';
import Stripe from 'stripe';

const prisma = new PrismaClient();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

async function main() {
  const stale = await prisma.invoice.findMany({
    where: {
      stripePaymentLinkId: { not: null },
      OR: [{ status: { in: ['PAID', 'VOID'] } }, { amountDue: { lte: 0 } }],
    },
    select: { id: true, invoiceNumber: true, status: true, amountDue: true, stripePaymentLinkId: true },
  });
  console.log(`${stale.length} settled/void invoices still carry a payment link`);

  let deactivated = 0;
  for (const inv of stale) {
    try {
      const link = await stripe.paymentLinks.update(inv.stripePaymentLinkId!, { active: false });
      console.log(`deactivated ${link.id} (${inv.invoiceNumber}, ${inv.status}, due ${inv.amountDue})`);
      deactivated++;
    } catch (err) {
      console.error(`FAILED ${inv.stripePaymentLinkId} (${inv.invoiceNumber}):`, err instanceof Error ? err.message : err);
    }
  }
  console.log(`done: ${deactivated}/${stale.length} deactivated`);
}

main().finally(() => prisma.$disconnect());
