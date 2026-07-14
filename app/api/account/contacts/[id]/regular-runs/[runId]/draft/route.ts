export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApiSession } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';
import { getNextInvoiceNumber, getNextBuckeyeInvoiceNumber } from '@/lib/account/invoice-number';

// POST /api/account/contacts/[id]/regular-runs/[runId]/draft
// One-click: generate a DRAFT invoice pre-filled from this saved run.
// Each line = "<drop location>" @ quantity=miles, unitAmount=rate ($/mi).
//
// Body (all optional):
//   miles      — override the run's default miles for this draft
//   rate       — override $/mi for this draft
//   runIds     — additional saved-run ids to bundle into the SAME invoice
//                (multi-drop day). The route's runId is always included first.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; runId: string }> },
) {
  try {
    const check = await requireAdminApiSession();
    if (!check.ok) return check.response;

    const { id: contactId, runId } = await params;

    const contact = await prisma.accountContact.findUnique({
      where: { id: contactId },
      select: { id: true, name: true },
    });
    if (!contact) return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
    const isBuckeye = /buckeye/i.test(contact.name);

    const body = await request.json().catch(() => ({}));

    // Assemble the ordered list of runs for this invoice (primary first).
    const extraIds: string[] = Array.isArray(body.runIds)
      ? body.runIds.map(String).filter((rid: string) => rid && rid !== runId)
      : [];
    const wantedIds = [runId, ...extraIds];

    const runs = await prisma.regularRun.findMany({
      where: { id: { in: wantedIds }, contactId },
    });
    const runById = new Map(runs.map((r) => [r.id, r]));
    const ordered = wantedIds.map((rid) => runById.get(rid)).filter(Boolean) as typeof runs;

    if (ordered.length === 0)
      return NextResponse.json({ error: 'Run not found' }, { status: 404 });

    // Overrides only apply when a single run is drafted (the common case).
    const single = ordered.length === 1;
    const overrideMiles = single && body.miles !== undefined ? Number(body.miles) : undefined;
    const overrideRate = single && body.rate !== undefined ? Number(body.rate) : undefined;

    let subTotal = 0;
    const lineItems = ordered.map((run, index) => {
      // FLAT (weight-based): one line, qty 1, unit = the flat default $ (edited
      // per week before send). MILEAGE: qty = miles, unit = $/mi.
      const flat = run.billingMode === 'FLAT';
      const qty = flat
        ? 1
        : overrideMiles !== undefined && Number.isFinite(overrideMiles) && overrideMiles > 0
          ? overrideMiles
          : run.miles;
      const unit =
        overrideRate !== undefined && Number.isFinite(overrideRate) && overrideRate > 0
          ? overrideRate
          : run.rate;
      const lineAmount = qty * unit;
      subTotal += lineAmount;
      return {
        description: run.dropLocation,
        quantity: qty,
        unitAmount: unit,
        lineAmount,
        sortOrder: index,
      };
    });

    // Weight-based drafts carry a reminder to set the week's amount before send.
    const hasFlat = ordered.some((r) => r.billingMode === 'FLAT');
    const notes = hasFlat
      ? 'Weight-based billing — adjust the amount to this week\'s weight/weight limit before sending.'
      : null;

    const invoiceNumber = isBuckeye
      ? await getNextBuckeyeInvoiceNumber()
      : await getNextInvoiceNumber();

    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber,
        contactId,
        status: 'DRAFT',
        reference: single ? ordered[0].label : `Regular runs (${ordered.length} drops)`,
        notes,
        subTotal,
        total: subTotal,
        amountDue: subTotal,
        lineItems: { create: lineItems },
      },
      select: { id: true, invoiceNumber: true, total: true },
    });

    // Stamp lastUsedAt so the UI can surface most-recently-used runs.
    await prisma.regularRun.updateMany({
      where: { id: { in: ordered.map((r) => r.id) } },
      data: { lastUsedAt: new Date() },
    });

    return NextResponse.json(invoice, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof Response) throw error;
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
