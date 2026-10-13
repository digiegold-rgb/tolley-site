import { randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { rateLimitByIp } from '@/lib/rate-limit';
import { normalizeAttribution } from '@/lib/discovery-attribution';
import { safeId, sameOrigin } from '@/lib/customer-history/core';
import { getSubsite } from '@/lib/subsites';
export async function POST(req: Request) {
  if (!sameOrigin(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const limited = await rateLimitByIp(req, 'contact-reference', 40, 3600); if (limited) return limited;
  const b = await req.json().catch(() => null);
  const sessionId = safeId(b?.sessionId), offering = typeof b?.offering === 'string' ? b.offering : '';
  if (!sessionId || getSubsite(offering)?.discovery?.disposition !== 'offering') return NextResponse.json({ error: 'Invalid session or offering' }, { status: 400 });
  const row = await prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${sessionId + ":" + offering}))`;
    return tx.contactReference.upsert({ where: { sessionId_offering: { sessionId, offering } }, create: { code: 'TLY-' + randomBytes(6).toString('hex').toUpperCase(), sessionId, offering, visitorId: safeId(b.visitorId), attribution: normalizeAttribution(b.attribution) }, update: {} });
  });
  return NextResponse.json({ code: row.code }, { headers: { 'Cache-Control': 'no-store' } });
}
