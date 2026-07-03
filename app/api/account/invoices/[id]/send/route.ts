export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApiSession } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';
import { createInvoicePaymentLink } from '@/lib/account/stripe-payment-link';
import { sendInvoiceEmail } from '@/lib/account/invoice-email';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: NextRequest, context: RouteContext) {
  try {
    const check = await requireAdminApiSession();
    if (!check.ok) return check.response;
    const { id } = await context.params;

    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        contact: { select: { name: true, email: true } },
        lineItems: true,
        _count: { select: { attachments: true } },
      },
    });

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    if (invoice.status === 'PAID') {
      return NextResponse.json({ error: 'Invoice already paid' }, { status: 400 });
    }

    if (invoice.status === 'VOID') {
      return NextResponse.json({ error: 'Cannot send a voided invoice' }, { status: 400 });
    }

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

    let emailSent = false;
    let emailError: string | null = null;

    if (invoice.contact?.email) {
      try {
        await sendInvoiceEmail({
          to: invoice.contact.email,
          contactName: invoice.contact.name || null,
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
          status: invoice.status === 'OVERDUE' ? 'OVERDUE' : 'SENT',
          sentAt: new Date(),
        },
      });
    }

    return NextResponse.json({
      paymentLinkUrl,
      emailSent,
      emailError,
      contactEmail: invoice.contact?.email || null,
    });
  } catch (error: unknown) {
    if (error instanceof Response) throw error;
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
