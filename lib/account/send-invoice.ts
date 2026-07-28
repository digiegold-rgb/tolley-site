import { prisma } from '@/lib/prisma';
import { createInvoicePaymentLink } from '@/lib/account/stripe-payment-link';
import { sendInvoiceEmail } from '@/lib/account/invoice-email';

export interface SendInvoiceOptions {
  /** Override the recipient; defaults to the contact's email on file. */
  to?: string | null;
  cc?: string[];
}

export interface SendInvoiceResult {
  id: string;
  invoiceNumber: string;
  paymentLinkUrl: string | null;
  emailSent: boolean;
  emailError: string | null;
  contactEmail: string | null;
  cc: string[];
}

/**
 * Send (or re-send) one invoice: ensure a Stripe payment link exists, email it,
 * and stamp SENT/sentAt on success. Shared by the single-invoice send route and
 * the bulk resend route so both behave identically.
 *
 * Re-sending deliberately REUSES the existing payment link rather than minting a
 * new one — a second live link is how Wayne Clark got double-charged. The link
 * carries `completed_sessions: { limit: 1 }`, so once it's paid it's dead.
 */
export async function sendInvoiceById(
  id: string,
  options: SendInvoiceOptions = {},
): Promise<SendInvoiceResult> {
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      contact: { select: { name: true, email: true } },
      lineItems: true,
      _count: { select: { attachments: true } },
    },
  });

  if (!invoice) throw new Error('Invoice not found');
  if (invoice.status === 'PAID') throw new Error('Invoice already paid');
  if (invoice.status === 'VOID') throw new Error('Cannot send a voided invoice');

  let paymentLinkUrl = invoice.stripePaymentLinkUrl;

  if (!paymentLinkUrl) {
    const link = await createInvoicePaymentLink({
      id: invoice.id,
      total: invoice.total,
      invoiceNumber: invoice.invoiceNumber,
      contact: invoice.contact,
    });
    paymentLinkUrl = link.paymentLinkUrl;

    await prisma.invoice.update({
      where: { id },
      data: {
        stripePaymentLinkId: link.paymentLinkId,
        stripePaymentLinkUrl: link.paymentLinkUrl,
      },
    });
  }

  const ccList = options.cc ?? [];
  const recipient = options.to?.trim() || invoice.contact?.email || null;

  let emailSent = false;
  let emailError: string | null = null;

  if (recipient) {
    try {
      await sendInvoiceEmail({
        to: recipient,
        cc: ccList.length ? ccList : undefined,
        contactName: invoice.contact?.name || null,
        invoiceNumber: invoice.invoiceNumber,
        issueDate: invoice.issueDate,
        dueDate: invoice.dueDate,
        lineItems: invoice.lineItems.map((li) => ({
          description: li.description,
          quantity: li.quantity,
          unitAmount: li.unitAmount,
          lineAmount: li.lineAmount,
        })),
        subTotal: invoice.subTotal,
        total: invoice.total,
        amountDue: invoice.amountDue,
        notes: invoice.notes,
        paymentLinkUrl: paymentLinkUrl!,
        attachmentCount: invoice._count.attachments,
      });
      emailSent = true;
    } catch (err) {
      emailError = err instanceof Error ? err.message : 'Unknown email error';
      console.error(`[invoice-send] email failed for ${invoice.invoiceNumber}:`, emailError);
    }
  } else {
    emailError = 'Contact has no email on file';
  }

  if (emailSent) {
    await prisma.invoice.update({
      where: { id },
      data: {
        // A resend must not downgrade an OVERDUE invoice back to SENT.
        status: invoice.status === 'OVERDUE' ? 'OVERDUE' : 'SENT',
        sentAt: new Date(),
      },
    });
  }

  return {
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    paymentLinkUrl,
    emailSent,
    emailError,
    contactEmail: recipient,
    cc: ccList,
  };
}
