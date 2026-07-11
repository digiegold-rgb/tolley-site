export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApiSession } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';

// GET /api/account/contacts/[id]/regular-runs — list a contact's saved runs.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const check = await requireAdminApiSession();
    if (!check.ok) return check.response;

    const { id: contactId } = await params;
    const runs = await prisma.regularRun.findMany({
      where: { contactId, active: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    return NextResponse.json({ runs });
  } catch (error: unknown) {
    if (error instanceof Response) throw error;
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/account/contacts/[id]/regular-runs — create a saved run.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const check = await requireAdminApiSession();
    if (!check.ok) return check.response;

    const { id: contactId } = await params;
    const contact = await prisma.accountContact.findUnique({
      where: { id: contactId },
      select: { id: true },
    });
    if (!contact) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
    }

    const body = await request.json();
    const label = String(body.label ?? '').trim();
    const dropLocation = String(body.dropLocation ?? '').trim();
    const billingMode = body.billingMode === 'FLAT' ? 'FLAT' : 'MILEAGE';
    // FLAT (weight-based): miles unused → store 1; rate = default flat $.
    const miles = billingMode === 'FLAT' ? 1 : Number(body.miles);
    const rate = body.rate === undefined || body.rate === null ? 3 : Number(body.rate);

    if (!label) return NextResponse.json({ error: 'Label is required' }, { status: 400 });
    if (!dropLocation)
      return NextResponse.json({ error: 'Drop location is required' }, { status: 400 });
    if (billingMode === 'MILEAGE' && (!Number.isFinite(miles) || miles <= 0))
      return NextResponse.json({ error: 'Miles must be a positive number' }, { status: 400 });
    if (!Number.isFinite(rate) || rate < 0)
      return NextResponse.json({ error: 'Amount must be a non-negative number' }, { status: 400 });

    const maxSort = await prisma.regularRun.aggregate({
      where: { contactId },
      _max: { sortOrder: true },
    });

    const run = await prisma.regularRun.create({
      data: {
        contactId,
        label,
        dropLocation,
        billingMode,
        miles,
        rate,
        notes: body.notes ? String(body.notes).trim() : null,
        sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
      },
    });
    return NextResponse.json(run, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof Response) throw error;
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
