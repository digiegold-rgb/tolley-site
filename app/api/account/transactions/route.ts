// @ts-nocheck — references removed Prisma models
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApiSession } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    await requireAdminApiSession();

    const { searchParams } = request.nextUrl;
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)));
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const needsReview = searchParams.get('needsReview');
    const bankAccount = searchParams.get('bankAccount');
    const q = searchParams.get('q');

    const where: Record<string, unknown> = {};

    if (from || to) {
      const dateFilter: Record<string, Date> = {};
      if (from) dateFilter.gte = new Date(from);
      if (to) dateFilter.lte = new Date(to);
      where.date = dateFilter;
    }

    if (needsReview !== null && needsReview !== undefined && needsReview !== '') {
      where.needsReview = needsReview === 'true';
    }

    if (bankAccount) {
      where.bankAccountId = bankAccount;
    }

    if (q) {
      where.description = { contains: q, mode: 'insensitive' };
    }

    const [transactions, total] = await Promise.all([
      prisma.ledgerTransaction.findMany({
        where,
        orderBy: { date: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          bankAccount: { select: { id: true, name: true, code: true } },
        },
      }),
      prisma.ledgerTransaction.count({ where }),
    ]);

    return NextResponse.json({
      transactions,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error: unknown) {
    if (error instanceof Response) throw error;
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
