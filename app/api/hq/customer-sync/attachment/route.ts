import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authorized } from '@/lib/customer-history/sync-auth';
import { encryptMedia } from '@/lib/customer-history/media';
export const runtime = 'nodejs';
export async function POST(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const threadId = req.headers.get('x-thread-id') || '', eventId = req.headers.get('x-event-id') || '', guid = req.headers.get('x-attachment-id') || '';
  const thread = await prisma.hqPhoneThread.findUnique({ where: { id: threadId }, include: { customer: true } });
  const event = await prisma.hqCustomerEvent.findUnique({ where: { id: eventId } });
  if (!thread?.customerId || thread.status !== 'selected' || thread.customer?.deletedAt || event?.customerId !== thread.customerId || (event.meta as { retracted?: boolean })?.retracted) return NextResponse.json({ error: 'Not selected' }, { status: 409 });
  const mime = req.headers.get('content-type') || '';
  if (!['image/jpeg', 'image/png', 'image/heic', 'image/heif', 'application/pdf'].includes(mime) || !guid || guid.length > 200) return NextResponse.json({ error: 'Unsupported attachment' }, { status: 400 });
  const bytes = Buffer.from(await req.arrayBuffer()); if (!bytes.length || bytes.length > 4000000) return NextResponse.json({ error: 'Attachment too large' }, { status: 413 });
  const sourceKey = `apple:${threadId}:${guid}`;
  await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "HqPhoneThread" WHERE id = ${threadId} FOR UPDATE`;
    if ((await tx.hqPhoneThread.findUnique({ where: { id: threadId } }))?.status !== 'selected') throw new Error('Thread selection changed');
    if (req.headers.get('x-preview') === '1') {
      await tx.hqCustomerAttachment.update({ where: { sourceKey }, data: { encryptedPreview: encryptMedia(bytes) } });
      return;
    }
    await tx.hqCustomerAttachment.upsert({ where: { sourceKey }, create: { eventId, sourceKey, mime, name: (req.headers.get('x-file-name') || 'Customer attachment').slice(0, 200), size: bytes.length, encrypted: encryptMedia(bytes) }, update: {} });
  });
  return NextResponse.json({ ok: true });
}
