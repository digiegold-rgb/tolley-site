// @ts-nocheck — references removed Prisma models
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApiSession } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';
import { getNextInvoiceNumber } from '@/lib/account/invoice-number';

export async function GET(request: NextRequest) {
  try {
    await requireAdminApiSession();

    const { searchParams } = request.nextUrl;
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
    const status = searchParams.get('status');

    const where: Record<string, unknown> = {};
    if (status) where.status = status;

    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        orderBy: { issueDate: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          contact: { select: { id: true, name: true, email: true } },
          _count: { select: { lineItems: true, payments: true } },
        },
      }),
      prisma.invoice.count({ where }),
    ]);

    return NextResponse.json({
      invoices,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error: unknown) {
    if (error instanceof Response) throw error;
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdminApiSession();

    const body = await request.json();
    const { contactId, dueDate, reference, notes, lineItems } = body;

    if (!lineItems || !Array.isArray(lineItems) || lineItems.length === 0) {
      return NextResponse.json({ error: 'At least one line item is required' }, { status: 400 });
    }

    const invoiceNumber = await getNextInvoiceNumber();

    let subTotal = 0;
    const processedItems = lineItems.map(
      (item: { description: string; quantity?: number; unitAmount: number; accountId?: string }) => {
        const qty = item.quantity || 1;
        const lineAmount = qty * item.unitAmount;
        subTotal += lineAmount;
        return {
          description: item.description,
          quantity: qty,
          unitAmount: item.unitAmount,
          lineAmount,
          accountId: item.accountId || null,
        };
      },
    );

    const total = subTotal;

    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber,
        contactId: contactId || null,
        dueDate: dueDate ? new Date(dueDate) : null,
        reference: reference || null,
        notes: notes || null,
        subTotal,
        total,
        amountDue: total,
        lineItems: { create: processedItems },
      },
      include: {
        lineItems: true,
        contact: { select: { id: true, name: true, email: true } },
      },
    });

    return NextResponse.json(invoice, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof Response) throw error;
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
