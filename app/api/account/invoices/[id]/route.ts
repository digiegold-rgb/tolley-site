export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApiSession } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const check = await requireAdminApiSession();
    if (!check.ok) return check.response;
    const { id } = await context.params;

    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        lineItems: {
          include: { account: { select: { code: true, name: true } } },
          orderBy: { sortOrder: 'asc' },
        },
        payments: true,
        contact: true,
        attachments: { orderBy: { uploadedAt: "desc" } },
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
    const check = await requireAdminApiSession();
    if (!check.ok) return check.response;
    const { id } = await context.params;

    const body = await request.json();
    const { contactId, dueDate, reference, notes, status, lineItems, invoiceNumber } = body;

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

    if (typeof invoiceNumber === 'string') {
      const next = invoiceNumber.trim();
      if (!next) {
        return NextResponse.json({ error: 'Invoice number cannot be empty' }, { status: 400 });
      }
      if (next !== existing.invoiceNumber) {
        const collide = await prisma.invoice.findUnique({
          where: { invoiceNumber: next },
          select: { id: true },
        });
        if (collide && collide.id !== id) {
          return NextResponse.json(
            { error: `Invoice number "${next}" is already used.` },
            { status: 409 },
          );
        }
        updateData.invoiceNumber = next;
      }
    }

    if (lineItems && Array.isArray(lineItems)) {
      // Delete existing line items and recreate
      await prisma.invoiceLineItem.deleteMany({ where: { invoiceId: id } });

      let subTotal = 0;
      const processedItems = lineItems.map(
        (item: { description: string; quantity?: number; unitAmount: number; accountId?: string }, index: number) => {
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
            sortOrder: index, // preserve the editor's row order
          };
        },
      );

      await prisma.invoiceLineItem.createMany({ data: processedItems });

      updateData.subTotal = subTotal;
      updateData.total = subTotal;
      updateData.amountDue = subTotal - existing.amountPaid;

      // A payment link's price is frozen at mint time and the send route reuses
      // any stored link — so a total change must retire the old link or the
      // customer pays the stale amount (Wayne Clark paid $84 twice against a
      // $33 invoice). Next send mints a fresh link at the new total.
      if (subTotal !== existing.total && existing.stripePaymentLinkId) {
        try {
          const { getStripeClient } = await import('@/lib/stripe');
          await getStripeClient().paymentLinks.update(existing.stripePaymentLinkId, {
            active: false,
          });
        } catch (err) {
          console.error(
            `[invoice-patch] failed to deactivate stale link ${existing.stripePaymentLinkId}:`,
            err instanceof Error ? err.message : err,
          );
        }
        updateData.stripePaymentLinkId = null;
        updateData.stripePaymentLinkUrl = null;
      }
    }

    // A status flip must settle the money fields with it. A status-only PATCH
    // used to leave amountPaid=0 / amountDue=total / paidAt=null on PAID rows —
    // the source of the pre-2026-07-27 A/R corruption.
    if (typeof status === 'string' && status !== existing.status) {
      const effectiveTotal = (updateData.total as number | undefined) ?? existing.total;
      if (status === 'PAID') {
        updateData.amountPaid = effectiveTotal;
        updateData.amountDue = 0;
        updateData.paidAt = existing.paidAt ?? new Date();
      } else if (existing.status === 'PAID') {
        updateData.amountDue = effectiveTotal - existing.amountPaid;
        updateData.paidAt = existing.amountPaid > 0 ? existing.paidAt : null;
      }
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
    const check = await requireAdminApiSession();
    if (!check.ok) return check.response;
    const { id } = await context.params;

    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        attachments: { select: { blobUrl: true } },
        _count: { select: { payments: true } },
      },
    });
    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    // Refuse to nuke an invoice that has payments recorded against it —
    // would silently destroy ledger history. Force the user to refund/reverse first.
    if (invoice._count.payments > 0 || invoice.amountPaid > 0) {
      return NextResponse.json(
        {
          error:
            'Cannot delete: this invoice has payments. Reverse the payments first, then void.',
        },
        { status: 409 },
      );
    }

    // Best-effort cleanup of attachment blobs before the cascade-delete drops their rows.
    if (invoice.attachments.length > 0) {
      const { del } = await import('@vercel/blob');
      await Promise.all(
        invoice.attachments.map(async (a) => {
          try {
            await del(a.blobUrl);
          } catch {
            // Orphaned blob is acceptable — don't block the delete.
          }
        }),
      );
    }

    await prisma.invoice.delete({ where: { id } });

    return NextResponse.json({ success: true, deleted: true });
  } catch (error: unknown) {
    if (error instanceof Response) throw error;
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
