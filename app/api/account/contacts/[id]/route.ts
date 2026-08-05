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

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// PATCH /api/account/contacts/[id] — edit contact fields. ccEmails is a
// comma/semicolon-separated list CC'd on every invoice send for this contact.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const check = await requireAdminApiSession();
    if (!check.ok) return check.response;

    const { id } = await params;
    const body = await request.json();

    const data: Record<string, unknown> = {};
    for (const field of ['name', 'email', 'phone', 'address', 'city', 'state', 'zip'] as const) {
      if (field in body) data[field] = body[field] ? String(body[field]).trim() : null;
    }
    if ('ccEmails' in body) {
      const parts = String(body.ccEmails ?? '')
        .split(/[,;]/)
        .map((e: string) => e.trim())
        .filter(Boolean);
      const bad = parts.filter((e: string) => !EMAIL_RE.test(e));
      if (bad.length) {
        return NextResponse.json({ error: `Invalid CC email(s): ${bad.join(', ')}` }, { status: 400 });
      }
      data.ccEmails = parts.length ? parts.join(', ') : null;
    }
    if ('name' in data && !data.name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }
    if (!Object.keys(data).length) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    const contact = await prisma.accountContact.update({ where: { id }, data });
    return NextResponse.json({ contact });
  } catch (error: unknown) {
    if (error instanceof Response) throw error;
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
