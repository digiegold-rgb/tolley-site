export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApiSession } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';

// PATCH /api/account/contacts/[id]/regular-runs/[runId] — edit a saved run.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; runId: string }> },
) {
  try {
    const check = await requireAdminApiSession();
    if (!check.ok) return check.response;

    const { id: contactId, runId } = await params;
    const existing = await prisma.regularRun.findFirst({
      where: { id: runId, contactId },
      select: { id: true },
    });
    if (!existing) return NextResponse.json({ error: 'Run not found' }, { status: 404 });

    const body = await request.json();
    const data: Record<string, unknown> = {};

    if (body.billingMode !== undefined) {
      data.billingMode = body.billingMode === 'FLAT' ? 'FLAT' : 'MILEAGE';
    }
    if (body.label !== undefined) {
      const label = String(body.label).trim();
      if (!label) return NextResponse.json({ error: 'Label cannot be empty' }, { status: 400 });
      data.label = label;
    }
    if (body.dropLocation !== undefined) {
      const drop = String(body.dropLocation).trim();
      if (!drop)
        return NextResponse.json({ error: 'Drop location cannot be empty' }, { status: 400 });
      data.dropLocation = drop;
    }
    if (body.miles !== undefined) {
      const miles = Number(body.miles);
      if (!Number.isFinite(miles) || miles <= 0)
        return NextResponse.json({ error: 'Miles must be positive' }, { status: 400 });
      data.miles = miles;
    }
    if (body.rate !== undefined) {
      const rate = Number(body.rate);
      if (!Number.isFinite(rate) || rate < 0)
        return NextResponse.json({ error: 'Amount must be non-negative' }, { status: 400 });
      data.rate = rate;
    }
    if (body.notes !== undefined) data.notes = body.notes ? String(body.notes).trim() : null;
    if (body.sortOrder !== undefined) data.sortOrder = Number(body.sortOrder);

    const run = await prisma.regularRun.update({ where: { id: runId }, data });
    return NextResponse.json(run);
  } catch (error: unknown) {
    if (error instanceof Response) throw error;
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/account/contacts/[id]/regular-runs/[runId] — soft-remove a run
// (active=false) so historical drafts that referenced it stay intact.
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; runId: string }> },
) {
  try {
    const check = await requireAdminApiSession();
    if (!check.ok) return check.response;

    const { id: contactId, runId } = await params;
    const existing = await prisma.regularRun.findFirst({
      where: { id: runId, contactId },
      select: { id: true },
    });
    if (!existing) return NextResponse.json({ error: 'Run not found' }, { status: 404 });

    await prisma.regularRun.update({ where: { id: runId }, data: { active: false } });
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    if (error instanceof Response) throw error;
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
