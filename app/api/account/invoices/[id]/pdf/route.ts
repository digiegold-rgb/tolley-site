export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApiSession } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';
import { buildInvoicePdf } from '@/lib/account/invoice-pdf';

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/account/invoices/:id/pdf  ->  downloadable invoice sheet (PDF)
export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const check = await requireAdminApiSession();
    if (!check.ok) return check.response;
    const { id } = await context.params;

    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        lineItems: { orderBy: { sortOrder: 'asc' } },
        contact: true,
      },
    });

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    const bytes = await buildInvoicePdf({
      invoiceNumber: invoice.invoiceNumber,
      status: invoice.status,
      issueDate: invoice.issueDate,
      dueDate: invoice.dueDate,
      reference: invoice.reference,
      notes: invoice.notes,
      subTotal: invoice.subTotal,
      total: invoice.total,
      amountPaid: invoice.amountPaid,
      amountDue: invoice.amountDue,
      stripePaymentLinkUrl: invoice.stripePaymentLinkUrl,
      contact: invoice.contact
        ? {
            name: invoice.contact.name,
            email: invoice.contact.email,
            phone: invoice.contact.phone,
            address: invoice.contact.address,
            city: invoice.contact.city,
            state: invoice.contact.state,
            zip: invoice.contact.zip,
          }
        : null,
      lineItems: invoice.lineItems.map((li) => ({
        description: li.description,
        quantity: li.quantity,
        unitAmount: li.unitAmount,
        lineAmount: li.lineAmount,
      })),
    });

    const fileName = `${invoice.invoiceNumber.replace(/[^a-zA-Z0-9._-]+/g, '_')}.pdf`;

    return new NextResponse(Buffer.from(bytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error: unknown) {
    if (error instanceof Response) throw error;
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
