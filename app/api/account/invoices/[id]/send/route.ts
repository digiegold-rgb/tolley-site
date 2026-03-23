// @ts-nocheck — references removed Prisma models
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApiSession } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';
import { createInvoicePaymentLink } from '@/lib/account/stripe-payment-link';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: NextRequest, context: RouteContext) {
  try {
    await requireAdminApiSession();
    const { id } = await context.params;

    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: { contact: { select: { name: true, email: true } } },
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

      await prisma.invoice.update({
        where: { id },
        data: {
          stripePaymentLinkId: link.paymentLinkId,
          stripePaymentLinkUrl: link.paymentLinkUrl,
          status: 'SENT',
          sentAt: new Date(),
        },
      });

      paymentLinkUrl = link.paymentLinkUrl;
    } else {
      await prisma.invoice.update({
        where: { id },
        data: {
          status: 'SENT',
          sentAt: new Date(),
        },
      });
    }

    return NextResponse.json({ paymentLinkUrl });
  } catch (error: unknown) {
    if (error instanceof Response) throw error;
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
