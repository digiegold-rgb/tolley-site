// @ts-nocheck — Xero models removed from schema (cancelled 3/21)
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { requireAdminApiSession } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    await requireAdminApiSession();

    const accounts = await prisma.ledgerAccount.findMany({
      orderBy: { code: 'asc' },
    });

    return NextResponse.json({ accounts });
  } catch (error: unknown) {
    if (error instanceof Response) throw error;
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
