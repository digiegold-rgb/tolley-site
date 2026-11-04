import { NextResponse } from 'next/server';
import { validateOwnerTool } from '@/lib/leads/owner-tool-auth';
import { readArchive, saveCorrection } from '@/lib/route-history/store';
import { validDate, sameRequestOrigin, type Correction } from '@/lib/route-history/core';
export const dynamic = 'force-dynamic';
const reply = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { 'Cache-Control': 'private, no-store' } });
export async function GET() {
  try { return reply(await readArchive()); } catch { return reply({ error: 'Delivery history could not be loaded. Please retry.' }, 503); }
}
export async function PATCH(req: Request) {
  if (!await validateOwnerTool()) return reply({ error: 'Unauthorized' }, 401);
  if (!sameRequestOrigin(req)) return reply({ error: 'Forbidden' }, 403);
  const b = await req.json().catch(() => null);
  if (!b || typeof b.id !== 'string' || !b.changes || typeof b.changes !== 'object' || Array.isArray(b.changes)) return reply({ error: 'Invalid correction' }, 400);
  const c = b.changes as Correction;
  if (Object.keys(c).some(k => !['date', 'weightLbs', 'excluded', 'notes', 'reviewed'].includes(k)) || ('date' in c && c.date !== null && !validDate(c.date)) || ('weightLbs' in c && c.weightLbs !== null && (typeof c.weightLbs !== 'number' || !Number.isFinite(c.weightLbs) || c.weightLbs < 0 || c.weightLbs > 1000000)) || ('notes' in c && (typeof c.notes !== 'string' || c.notes.length > 2000)) || ('excluded' in c && typeof c.excluded !== 'boolean') || ('reviewed' in c && typeof c.reviewed !== 'boolean')) return reply({ error: 'Check the date, pounds, and notes.' }, 400);
  try {
    const archive = await readArchive();
    if (!archive.deliveries.some(d => d.id === b.id)) return reply({ error: 'Delivery not found' }, 404);
    await saveCorrection(b.id, c);
    return reply({ ok: true });
  } catch { return reply({ error: 'Correction was not saved. Please retry.' }, 503); }
}
