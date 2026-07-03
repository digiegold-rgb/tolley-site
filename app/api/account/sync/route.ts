export const runtime = 'nodejs';
export const maxDuration = 60;

import { NextResponse } from 'next/server';
import { requireAdminApiSession } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';

const LEDGER_URL = process.env.LEDGER_URL || 'http://127.0.0.1:8920';

export async function POST() {
  const check = await requireAdminApiSession();
  if (!check.ok) return check.response;

  // Try to trigger a live Plaid pull on the local ledger daemon. Reachable when
  // tolley-site runs on DGX (local dev) or via tunnel; from Vercel serverless this
  // will fail fast — the daily 7:05 AM CT cron on DGX is the real sync mechanism.
  let liveSync: { added?: number; total?: number; error?: string } = { error: 'unreachable' };
  try {
    const res = await fetch(`${LEDGER_URL}/plaid/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) {
      const j = await res.json().catch(() => ({}));
      liveSync = { added: j.added, total: j.total };
    } else {
      liveSync = { error: `ledger ${res.status}` };
    }
  } catch (e) {
    liveSync = { error: e instanceof Error ? e.message : 'fetch failed' };
  }

  const lastIngest = await prisma.ledgerTransaction.findFirst({
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true },
  });
  const newestTx = await prisma.ledgerTransaction.findFirst({
    orderBy: { date: 'desc' },
    select: { date: true },
  });

  return NextResponse.json({
    success: true,
    liveSync,
    lastIngestAt: lastIngest?.createdAt || null,
    newestTxDate: newestTx?.date || null,
  });
}
