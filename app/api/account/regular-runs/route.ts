export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { requireAdminApiSession } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';

// GET /api/account/regular-runs — every active saved run, grouped by customer.
// Powers the "Regular Runs" tab in the Invoices area.
export async function GET() {
  try {
    const check = await requireAdminApiSession();
    if (!check.ok) return check.response;

    const contacts = await prisma.accountContact.findMany({
      where: { regularRuns: { some: { active: true } } },
      select: {
        id: true,
        name: true,
        _count: { select: { invoices: true } },
        regularRuns: {
          where: { active: true },
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
          select: {
            id: true,
            label: true,
            dropLocation: true,
            billingMode: true,
            miles: true,
            rate: true,
            notes: true,
            lastUsedAt: true,
          },
        },
      },
    });

    // Order clients by how actively they're billed: the most recently used run
    // first (weekly clients like Wayne float above monthly ones like Guadalupe),
    // then by invoice volume, then name.
    const lastUsed = (c: (typeof contacts)[number]) =>
      c.regularRuns.reduce((max, r) => {
        const t = r.lastUsedAt ? new Date(r.lastUsedAt).getTime() : 0;
        return t > max ? t : max;
      }, 0);

    contacts.sort((a, b) => {
      const d = lastUsed(b) - lastUsed(a);
      if (d !== 0) return d;
      const inv = b._count.invoices - a._count.invoices;
      if (inv !== 0) return inv;
      return a.name.localeCompare(b.name);
    });

    return NextResponse.json({ contacts });
  } catch (error: unknown) {
    if (error instanceof Response) throw error;
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
