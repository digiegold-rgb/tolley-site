export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApiSession } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';
import { buildInvoicePdf } from '@/lib/account/invoice-pdf';
import { createInvoiceDraft, invoiceDraftAccount } from '@/lib/account/invoice-draft';

type RouteContext = { params: Promise<{ id: string }> };

const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

// POST /api/account/invoices/:id/email-draft
// Builds the invoice PDF and saves a ready-to-send Gmail draft (with the PDF
// attached) in the jared@yourkchomes.com mailbox.
export async function POST(_request: NextRequest, context: RouteContext) {
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

    const pdf = await buildInvoicePdf({
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
    const amount = fmt.format(invoice.amountDue || invoice.total);
    const contactName = invoice.contact?.name || 'there';
    const greeting = invoice.contact?.name ? `Hi ${invoice.contact.name},` : 'Hi there,';

    const text = `${greeting}

Please find attached invoice ${invoice.invoiceNumber} from Your KC Homes LLC for ${amount}.

${invoice.stripePaymentLinkUrl ? `You can pay online here: ${invoice.stripePaymentLinkUrl}\n\n` : ''}Thank you for your business.

Your KC Homes LLC
Independence, MO`;

    const html = `<p>${greeting}</p>
<p>Please find attached invoice <strong>${invoice.invoiceNumber}</strong> from Your KC Homes LLC for <strong>${amount}</strong>.</p>
${invoice.stripePaymentLinkUrl ? `<p>You can <a href="${invoice.stripePaymentLinkUrl}">pay online here</a>.</p>` : ''}
<p>Thank you for your business.</p>
<p>Your KC Homes LLC<br/>Independence, MO</p>`;

    await createInvoiceDraft({
      to: invoice.contact?.email ?? null,
      subject: `Invoice ${invoice.invoiceNumber} from Your KC Homes LLC — ${amount}`,
      text,
      html,
      pdf,
      pdfFileName: fileName,
    });

    return NextResponse.json({
      ok: true,
      mailbox: invoiceDraftAccount,
      to: invoice.contact?.email ?? null,
      contactName,
    });
  } catch (error: unknown) {
    if (error instanceof Response) throw error;
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
