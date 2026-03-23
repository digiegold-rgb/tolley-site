export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { requireAdminApiSession } from '@/lib/admin-auth';
import { getNextInvoiceNumber } from '@/lib/account/invoice-number';

export async function GET() {
  try {
    await requireAdminApiSession();

    const number = await getNextInvoiceNumber();
    return NextResponse.json({ number });
  } catch (error: unknown) {
    if (error instanceof Response) throw error;
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
