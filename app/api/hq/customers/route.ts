import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateWdAdmin } from '@/lib/wd-auth';
import { customerForContact, linkSession, refreshCustomerSnapshots } from '@/lib/customer-history/store';
import { normalizeAttribution } from '@/lib/discovery-attribution';
import { sameOrigin } from '@/lib/customer-history/core';
export const dynamic = 'force-dynamic';
const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });
export async function GET(req: Request) {
  if (!(await validateWdAdmin()).authed) return reply({ error: 'Unauthorized' }, 401);
  const q = new URL(req.url).searchParams, id = q.get('id');
  if (id) {
    await refreshCustomerSnapshots(id);
    const customer = await prisma.hqCustomer.findFirst({ where: { id, deletedAt: null }, include: { links: true, threads: true } });
    if (!customer) return reply({ error: 'Not found' }, 404);
    const before = q.get('before');
    const timeline = await prisma.hqCustomerEvent.findMany({ where: { customerId: id }, ...(before ? { cursor: { id: before }, skip: 1 } : {}), orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }], take: 100, include: { attachments: { select: { id: true, name: true, mime: true, size: true } } } });
    const leadIds = customer.links.filter(l => l.kind === 'growth').map(l => l.sourceId);
    const opportunities = await prisma.growthLead.findMany({ where: { id: { in: leadIds } }, include: { discoveryRevenue: true } });
    const actions = await prisma.leadAction.findMany({ where: { id: { in: customer.links.filter(l => l.kind === 'action').map(l => l.sourceId) } }, select: { id: true, subsite: true, action: true, status: true, structured: true, createdAt: true } });
    return reply({ customer, timeline, opportunities, actions, nextBefore: timeline.length === 100 ? timeline.at(-1)!.id : null });
  }
  const search = q.get('q')?.slice(0, 100) || '';
  const customers = await prisma.hqCustomer.findMany({ where: { deletedAt: null, ...(search ? { OR: [{ name: { contains: search, mode: 'insensitive' as const } }, { phone: { contains: search } }, { email: { contains: search, mode: 'insensitive' as const } }] } : {}) }, orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }], take: 50, ...(q.get('cursor') ? { cursor: { id: q.get('cursor')! }, skip: 1 } : {}), include: { _count: { select: { timeline: true, links: true } } } });
  const [threads, sync] = await Promise.all([prisma.hqPhoneThread.findMany({ where: { status: 'candidate' }, orderBy: { lastMessageAt: 'desc' }, take: 100 }), prisma.hqSyncState.findUnique({ where: { id: 'apple-messages' } })]);
  return reply({ customers, threads, sync, nextCursor: customers.length === 50 ? customers.at(-1)!.id : null });
}
export async function POST(req: Request) {
  if (!(await validateWdAdmin()).authed) return reply({ error: 'Unauthorized' }, 401);
  if (!sameOrigin(req)) return reply({ error: 'Forbidden' }, 403);
  const b = await req.json().catch(() => null); if (!b || typeof b !== 'object') return reply({ error: 'Invalid request' }, 400);
  if (b.action === 'select-thread' || b.action === 'ignore-thread') {
    const thread = await prisma.hqPhoneThread.findUnique({ where: { id: String(b.threadId) } });
    if (!thread || thread.status === 'deleted') return reply({ error: 'Thread unavailable' }, 404);
    const customer = b.action === 'select-thread' ? await prisma.$transaction(tx => customerForContact(tx, { phone: thread.phone, name: thread.name })) : null;
    if (b.action === 'select-thread' && !customer) return reply({ error: 'Deleted contact cannot be resubscribed' }, 409);
    await prisma.hqPhoneThread.update({ where: { id: thread.id }, data: { status: customer ? 'selected' : 'ignored', customerId: customer?.id || null } });
    return reply({ ok: true, customerId: customer?.id });
  }
  const customer = await prisma.hqCustomer.findFirst({ where: { id: String(b.id || ''), deletedAt: null } });
  if (!customer) return reply({ error: 'Not found' }, 404);
  if (b.action === 'save') {
    const data = Object.fromEntries(['name', 'notes', 'reportedSource'].filter(k => typeof b[k] === 'string').map(k => [k, b[k].trim().slice(0, k === 'notes' ? 10000 : 300) || null]));
    await prisma.$transaction(async tx => {
      await tx.hqCustomer.update({ where: { id: customer.id }, data });
      if (typeof b.reportedSource === 'string') {
        const links = await tx.hqCustomerLink.findMany({ where: { customerId: customer.id, kind: { in: ['growth', 'action'] } } });
        for (const link of links) {
          if (link.kind === 'growth') { const lead = await tx.growthLead.findUnique({ where: { id: link.sourceId } }); if (lead) await tx.growthLead.update({ where: { id: lead.id }, data: { attribution: normalizeAttribution({ ...(lead.attribution as object || {}), reportedSource: b.reportedSource }) } }); }
          else { const lead = await tx.leadAction.findUnique({ where: { id: link.sourceId } }); if (lead) await tx.leadAction.update({ where: { id: lead.id }, data: { attribution: normalizeAttribution({ ...(lead.attribution as object || {}), reportedSource: b.reportedSource }) } }); }
        }
      }
      await tx.hqCustomerEvent.create({ data: { customerId: customer.id, sourceKey: `owner:${crypto.randomUUID()}`, kind: 'owner_note', body: 'Owner updated customer memory', meta: data, occurredAt: new Date() } });
    });
  } else if (b.action === 'link-session') {
    if (!['confirmed', 'probable'].includes(b.confidence) || typeof b.evidence !== 'string' || !b.evidence.trim()) return reply({ error: 'Evidence and confidence required' }, 400);
    await prisma.$transaction(tx => linkSession(tx, customer.id, String(b.sessionId), b.confidence, b.evidence.slice(0, 1000)));
  } else if (b.action === 'close' || b.action === 'reopen') {
    await prisma.hqCustomer.update({ where: { id: customer.id }, data: { closedAt: b.action === 'close' ? new Date() : null } });
  } else if (b.action === 'unsubscribe') {
    await prisma.hqPhoneThread.updateMany({ where: { customerId: customer.id }, data: { status: 'ignored' } });
  } else if (b.action === 'delete' && b.confirm === 'DELETE') {
    await prisma.$transaction(async tx => {
      await tx.hqPhoneThread.updateMany({ where: { customerId: customer.id }, data: { status: 'deleted', checkpoint: null, name: null } });
      await tx.hqCustomerEvent.deleteMany({ where: { customerId: customer.id } });
      await tx.hqCustomerLink.deleteMany({ where: { customerId: customer.id } });
      await tx.hqCustomer.update({ where: { id: customer.id }, data: { deletedAt: new Date(), name: null, notes: null, reportedSource: null } });
    });
  } else return reply({ error: 'Unknown action' }, 400);
  return reply({ ok: true });
}
