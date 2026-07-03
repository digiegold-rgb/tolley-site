export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApiSession } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';

type RouteContext = { params: Promise<{ id: string }> };

// ---------------------------------------------------------------------------
// Revert a PAID invoice back to SENT (or DRAFT if it was never sent) so it can
// be edited / resent. This is the undo for an accidental "Mark Paid".
//
// SAFETY GUARD: if the invoice has recorded payments or a linked Stripe
// PaymentIntent, the money very likely arrived — silently reverting would set
// up a double-bill. In that case we refuse with 409 PAYMENT_ON_RECORD and make
// the caller pass ?force=1 (after an explicit human confirmation in the UI).
// Even when forced we KEEP the payment records — we only flip status — so no
// ledger history is destroyed.
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const check = await requireAdminApiSession();
    if (!check.ok) return check.response;
    const { id } = await context.params;
    const force = new URL(request.url).searchParams.get('force') === '1';

    const inv = await prisma.invoice.findUnique({
      where: { id },
      include: { payments: true },
    });
    if (!inv) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }
    if (inv.status !== 'PAID') {
      return NextResponse.json(
        { error: `Invoice is ${inv.status}, not PAID — nothing to unmark.` },
        { status: 400 },
      );
    }

    const hasPaymentRecords = inv.payments.length > 0;
    const hasStripePI = !!inv.stripePaymentIntentId;

    if ((hasPaymentRecords || hasStripePI) && !force) {
      const detail = inv.payments
        .map(
          (p) =>
            `$${p.amount.toFixed(2)} via ${p.method ?? 'unknown'}${
              p.reference ? ` (${p.reference})` : ''
            }`,
        )
        .join('; ');
      return NextResponse.json(
        {
          error: 'PAYMENT_ON_RECORD',
          message:
            `This invoice has a payment on record — ` +
            `${hasPaymentRecords ? `${inv.payments.length} payment(s): ${detail}. ` : ''}` +
            `${hasStripePI ? `Linked Stripe PaymentIntent ${inv.stripePaymentIntentId}. ` : ''}` +
            `Verify the money truly did NOT arrive in Stripe/your bank before forcing this. ` +
            `Forcing keeps the payment records and only returns the status to "Sent".`,
          hasPaymentRecords,
          hasStripePI,
          stripePaymentIntentId: inv.stripePaymentIntentId,
        },
        { status: 409 },
      );
    }

    const nextStatus = inv.sentAt ? 'SENT' : 'DRAFT';
    const updated = await prisma.invoice.update({
      where: { id },
      data: {
        status: nextStatus,
        paidAt: null,
        // amountPaid is left intact (real payments shouldn't vanish). Recompute
        // the balance from whatever is genuinely recorded as paid.
        amountDue: inv.total - inv.amountPaid,
      },
    });

    return NextResponse.json({
      success: true,
      status: updated.status,
      keptPaymentRecords: inv.payments.length,
    });
  } catch (error: unknown) {
    if (error instanceof Response) throw error;
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
