import Stripe from 'stripe';
import { prisma } from '@/lib/prisma';

/**
 * Write-back for account invoices paid via a Stripe payment link (the links
 * minted by lib/account/stripe-payment-link.ts).
 *
 * The 2026-04 Xero cancellation removed the old payment sync, so paid invoices
 * stopped getting an InvoicePayment row / amountPaid / amountDue / PAID status
 * (e.g. Wayne INV-0145, paid via link 2026-06-05, never linked back). This
 * restores it at the webhook layer.
 *
 * A single payment-link checkout fires BOTH checkout.session.completed and
 * payment_intent.succeeded, and the daily scripts/stripe-invoice-reconcile.ts
 * sweep is a third path. All three funnel through applyPayment(), which is
 * idempotent on the PaymentIntent id, so a payment is recorded exactly once no
 * matter how many events arrive.
 */

type ResolvedInvoice = {
  id: string;
  total: number;
  amountPaid: number;
  status: string;
};

const INVOICE_SELECT = {
  id: true,
  total: true,
  amountPaid: true,
  status: true,
} as const;

// Resolve the account Invoice a payment belongs to. Prefers the invoiceId
// stamped on metadata (present on links minted after the payment_intent_data
// metadata fix), then falls back to matching the Stripe payment-link id we
// stored on the invoice — which is what lets pre-fix links reconcile without
// any PaymentIntent metadata.
async function resolveInvoice(opts: {
  invoiceId?: string | null;
  paymentLinkId?: string | null;
}): Promise<ResolvedInvoice | null> {
  if (opts.invoiceId) {
    const byId = await prisma.invoice.findUnique({
      where: { id: opts.invoiceId },
      select: INVOICE_SELECT,
    });
    if (byId) return byId;
  }
  if (opts.paymentLinkId) {
    const byLink = await prisma.invoice.findFirst({
      where: { stripePaymentLinkId: opts.paymentLinkId },
      select: INVOICE_SELECT,
    });
    if (byLink) return byLink;
  }
  return null;
}

// Idempotent write-back keyed on the PaymentIntent id. Returns true when it
// records a new payment, false when the payment was already recorded.
async function applyPayment(
  invoice: ResolvedInvoice,
  paymentIntentId: string,
  amount: number,
  note: string,
): Promise<boolean> {
  const existing = await prisma.invoicePayment.findFirst({
    where: { reference: paymentIntentId, method: 'stripe' },
    select: { id: true },
  });
  if (existing) return false;

  await prisma.invoicePayment.create({
    data: {
      invoiceId: invoice.id,
      amount,
      method: 'stripe',
      reference: paymentIntentId,
      notes: note,
    },
  });

  const newAmountPaid = invoice.amountPaid + amount;
  const newAmountDue = Math.max(0, invoice.total - newAmountPaid);
  const isPaid = newAmountDue <= 0.01;

  await prisma.invoice.update({
    where: { id: invoice.id },
    data: {
      amountPaid: newAmountPaid,
      amountDue: newAmountDue,
      status: isPaid ? 'PAID' : invoice.status,
      stripePaymentIntentId: paymentIntentId,
      paidAt: isPaid ? new Date() : undefined,
    },
  });

  console.log(
    `[invoice-payment] ${invoice.id} recorded $${amount} via ${paymentIntentId}, status: ${isPaid ? 'PAID' : invoice.status}`,
  );
  return true;
}

/**
 * Record an account-invoice payment from a payment_intent.succeeded event.
 * Resolves the invoice via paymentIntent.metadata.invoiceId. Returns true if a
 * new payment was recorded, false if it wasn't an account invoice or was a
 * duplicate.
 */
export async function recordInvoicePaymentFromIntent(
  paymentIntent: Stripe.PaymentIntent,
): Promise<boolean> {
  const invoice = await resolveInvoice({ invoiceId: paymentIntent.metadata?.invoiceId });
  if (!invoice) return false;

  const amount = (paymentIntent.amount_received ?? 0) / 100;
  if (amount <= 0) return false;

  return applyPayment(invoice, paymentIntent.id, amount, `Stripe payment ${paymentIntent.id}`);
}

/**
 * Record an account-invoice payment from a checkout.session.completed event.
 * Resolves the invoice via session.metadata.invoiceId or, failing that, the
 * session's payment_link id matched against the invoice's stripePaymentLinkId.
 * This is the path that reconciles links created before the PaymentIntent
 * metadata fix. Returns true if a new payment was recorded, false otherwise.
 */
export async function recordInvoicePaymentFromSession(
  session: Stripe.Checkout.Session,
): Promise<boolean> {
  if (session.payment_status !== 'paid') return false;

  const paymentIntentId =
    typeof session.payment_intent === 'string'
      ? session.payment_intent
      : session.payment_intent?.id;
  if (!paymentIntentId) return false;

  const paymentLinkId =
    typeof session.payment_link === 'string'
      ? session.payment_link
      : session.payment_link?.id ?? null;

  const invoice = await resolveInvoice({
    invoiceId: session.metadata?.invoiceId,
    paymentLinkId,
  });
  if (!invoice) return false;

  const amount = (session.amount_total ?? 0) / 100;
  if (amount <= 0) return false;

  return applyPayment(invoice, paymentIntentId, amount, `Stripe checkout ${session.id}`);
}
