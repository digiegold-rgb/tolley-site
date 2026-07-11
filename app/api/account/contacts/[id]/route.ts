export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApiSession } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';

// GET /api/account/contacts/[id] — one contact with its saved runs + recent invoices.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const check = await requireAdminApiSession();
    if (!check.ok) return check.response;

    const { id } = await params;
    const contact = await prisma.accountContact.findUnique({
      where: { id },
      include: {
        regularRuns: {
          where: { active: true },
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        },
        invoices: {
          orderBy: { issueDate: 'desc' },
          take: 25,
          select: {
            id: true,
            invoiceNumber: true,
            status: true,
            issueDate: true,
            total: true,
            amountDue: true,
            reference: true,
          },
        },
      },
    });

    if (!contact) return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
    return NextResponse.json({ contact });
  } catch (error: unknown) {
    if (error instanceof Response) throw error;
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
