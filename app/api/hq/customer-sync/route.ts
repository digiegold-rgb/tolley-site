import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authorized } from '@/lib/customer-history/sync-auth';
import { phoneE164 } from '@/lib/customer-history/core';
import { matchReferences } from '@/lib/customer-history/store';
import { Prisma } from '@prisma/client';
export const runtime = 'nodejs';
export const maxDuration = 60;
export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const threads = await prisma.hqPhoneThread.findMany({ where: { status: 'selected', customer: { deletedAt: null } }, select: { id: true, phone: true, checkpoint: true } });
  return NextResponse.json({ threads }, { headers: { 'Cache-Control': 'no-store' } });
}
export async function POST(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const raw = await req.text(); if (raw.length > 2000000) return NextResponse.json({ error: 'Too large' }, { status: 413 });
  let b; try { b = JSON.parse(raw); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  if (b.type === 'status') {
    await prisma.hqSyncState.upsert({ where: { id: 'apple-messages' }, create: { id: 'apple-messages' }, update: {} });
    await prisma.hqSyncState.update({ where: { id: 'apple-messages' }, data: { lastAttemptAt: new Date(), ...(b.ok ? { lastSuccessAt: new Date(), error: null } : { error: String(b.error || 'Sync failed').slice(0, 500) }), meta: b.meta || {} } });
    return NextResponse.json({ ok: true });
  }
  if (b.type === 'candidates' && Array.isArray(b.threads) && b.threads.length <= 500) {
    for (const t of b.threads) {
      const phone = phoneE164(t.phone); if (!phone || typeof t.id !== 'string' || t.id.length > 200 || !Number.isFinite(Date.parse(t.lastMessageAt))) continue;
      await prisma.hqPhoneThread.upsert({ where: { id: t.id }, create: { id: t.id, phone, name: typeof t.name === 'string' ? t.name.slice(0, 200) : null, lastMessageAt: new Date(t.lastMessageAt) }, update: { lastMessageAt: new Date(t.lastMessageAt) } });
    }
    return NextResponse.json({ ok: true });
  }
  if (b.type !== 'events' || !Array.isArray(b.events) || b.events.length > 100) return NextResponse.json({ error: 'Invalid batch' }, { status: 400 });
  const thread = await prisma.hqPhoneThread.findUnique({ where: { id: String(b.threadId) }, include: { customer: true } });
  if (!thread || thread.status !== 'selected' || !thread.customerId || thread.customer?.deletedAt) return NextResponse.json({ error: 'Thread is not selected' }, { status: 409 });
  const customerId = thread.customerId;
  const saved = await prisma.$transaction(async tx => {
    // Serialize imports with unsubscribe/delete so no content can arrive after deletion.
    await tx.$queryRaw`SELECT id FROM "HqPhoneThread" WHERE id = ${thread.id} FOR UPDATE`;
    const current = await tx.hqPhoneThread.findUnique({ where: { id: thread.id } });
    if (current?.status !== 'selected') throw new Error('Thread selection changed');
    const result: { sourceKey: string; id: string; attachments: string[] }[] = [];
    for (const e of b.events) {
      if (typeof e.guid !== 'string' || e.guid.length > 200 || !Number.isFinite(Date.parse(e.at)) || !['message', 'call', 'reaction'].includes(e.kind)) throw new Error('Invalid event');
      const sourceKey = `apple:${thread.id}:${e.guid}`;
      const body = e.retracted ? null : typeof e.body === 'string' ? e.body.slice(0, 50000) : null;
      const data = { kind: e.kind, body, occurredAt: new Date(e.at), meta: { direction: e.direction === 'out' ? 'out' : 'in', service: String(e.service || 'iMessage').slice(0, 30), edited: !!e.edited, retracted: !!e.retracted, decodeError: !!e.decodeError, answered: e.answered ?? null, duration: e.duration ?? null, reactionTo: e.reactionTo || null } as Prisma.InputJsonValue };
      const event = await tx.hqCustomerEvent.upsert({ where: { sourceKey }, create: { sourceKey, customerId, ...data }, update: data, include: { attachments: { select: { sourceKey: true, mime: true, encryptedPreview: true } } } });
      if (e.retracted) await tx.hqCustomerAttachment.deleteMany({ where: { eventId: event.id } });
      if (body && e.direction === 'in') await matchReferences(tx, customerId, body);
      result.push({ sourceKey: e.guid, id: event.id, attachments: event.attachments.filter(a => !["image/heic", "image/heif"].includes(a.mime) || a.encryptedPreview).map(a => a.sourceKey) });
    }
    await tx.hqPhoneThread.update({ where: { id: thread.id }, data: { lastSyncedAt: new Date(), ...(typeof b.checkpoint === 'string' ? { checkpoint: b.checkpoint.slice(0, 100) } : {}) } });
    return result;
  }, { timeout: 50000 });
  return NextResponse.json({ ok: true, saved });
}
