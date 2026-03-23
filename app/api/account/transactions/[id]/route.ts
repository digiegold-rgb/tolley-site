// @ts-nocheck — references removed Prisma models
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApiSession } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    await requireAdminApiSession();
    const { id } = await context.params;

    const body = await request.json();
    const { accountCode, isReconciled, needsReview, description } = body;

    const existing = await prisma.ledgerTransaction.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};
    if (accountCode !== undefined) updateData.accountCode = accountCode;
    if (isReconciled !== undefined) updateData.isReconciled = isReconciled;
    if (needsReview !== undefined) updateData.needsReview = needsReview;
    if (description !== undefined) updateData.description = description;

    const transaction = await prisma.ledgerTransaction.update({
      where: { id },
      data: updateData,
      include: { bankAccount: { select: { id: true, name: true, code: true } } },
    });

    return NextResponse.json(transaction);
  } catch (error: unknown) {
    if (error instanceof Response) throw error;
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
