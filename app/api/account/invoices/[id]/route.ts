// @ts-nocheck — references removed Prisma models
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApiSession } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    await requireAdminApiSession();
    const { id } = await context.params;

    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        lineItems: { include: { account: { select: { code: true, name: true } } } },
        payments: true,
        contact: true,
      },
    });

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    return NextResponse.json(invoice);
  } catch (error: unknown) {
    if (error instanceof Response) throw error;
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    await requireAdminApiSession();
    const { id } = await context.params;

    const body = await request.json();
    const { contactId, dueDate, reference, notes, status, lineItems } = body;

    const existing = await prisma.invoice.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};
    if (contactId !== undefined) updateData.contactId = contactId || null;
    if (dueDate !== undefined) updateData.dueDate = dueDate ? new Date(dueDate) : null;
    if (reference !== undefined) updateData.reference = reference;
    if (notes !== undefined) updateData.notes = notes;
    if (status !== undefined) updateData.status = status;

    if (lineItems && Array.isArray(lineItems)) {
      // Delete existing line items and recreate
      await prisma.invoiceLineItem.deleteMany({ where: { invoiceId: id } });

      let subTotal = 0;
      const processedItems = lineItems.map(
        (item: { description: string; quantity?: number; unitAmount: number; accountId?: string }) => {
          const qty = item.quantity || 1;
          const lineAmount = qty * item.unitAmount;
          subTotal += lineAmount;
          return {
            invoiceId: id,
            description: item.description,
            quantity: qty,
            unitAmount: item.unitAmount,
            lineAmount,
            accountId: item.accountId || null,
          };
        },
      );

      await prisma.invoiceLineItem.createMany({ data: processedItems });

      updateData.subTotal = subTotal;
      updateData.total = subTotal;
      updateData.amountDue = subTotal - existing.amountPaid;
    }

    const invoice = await prisma.invoice.update({
      where: { id },
      data: updateData,
      include: {
        lineItems: true,
        payments: true,
        contact: true,
      },
    });

    return NextResponse.json(invoice);
  } catch (error: unknown) {
    if (error instanceof Response) throw error;
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    await requireAdminApiSession();
    const { id } = await context.params;

    const invoice = await prisma.invoice.findUnique({ where: { id } });
    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    await prisma.invoice.update({
      where: { id },
      data: { status: 'VOID' },
    });

    return NextResponse.json({ success: true, status: 'VOID' });
  } catch (error: unknown) {
    if (error instanceof Response) throw error;
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
