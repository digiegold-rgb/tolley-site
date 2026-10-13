import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { phoneE164, safeId, referenceCodes } from './core';
import { normalizeAttribution } from '@/lib/discovery-attribution';
type DB = Prisma.TransactionClient;
const json = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
export async function customerForContact(tx: DB, contact: { phone?: string | null; email?: string | null; name?: string | null }) {
  const phone = phoneE164(contact.phone); const email = contact.email?.trim().toLowerCase();
  if (!phone && !email) return null;
  // Phone wins; an email conflict is left for owner review, never an automatic merge.
  if (phone) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${phone}))`;
    const existing = await tx.hqCustomer.findUnique({ where: { phone } });
    if (existing) return existing.deletedAt ? null : existing;
    return tx.hqCustomer.create({ data: { phone, name: contact.name?.slice(0, 200) || null } });
  }
  const customer = await tx.hqCustomer.upsert({ where: { email: email! }, create: { email, name: contact.name?.slice(0, 200) || null }, update: {} });
  return customer.deletedAt ? null : customer;
}
export async function linkSession(tx: DB, customerId: string, sessionId: string, confidence: string, evidence: string) {
  if (!safeId(sessionId)) return;
  const existing = await tx.hqCustomerLink.findUnique({ where: { kind_sourceId: { kind: 'session', sourceId: sessionId } } });
  if (existing && existing.customerId !== customerId) {
    await tx.hqCustomerEvent.upsert({ where: { sourceKey: `conflict:${customerId}:${sessionId}` }, create: { customerId, sourceKey: `conflict:${customerId}:${sessionId}`, kind: 'review', body: 'This browser session is already linked to another customer. Review the shared-device or reference-code evidence.', occurredAt: new Date() }, update: {} });
    return;
  }
  const [session, views, events] = await Promise.all([
    tx.visitorSession.findUnique({ where: { id: sessionId } }),
    tx.siteView.findMany({ where: { sessionId }, orderBy: { createdAt: 'asc' }, take: 300, select: { path: true, attribution: true, userAgent: true, city: true, region: true, createdAt: true } }),
    tx.siteEvent.findMany({ where: { sessionId }, orderBy: { createdAt: 'asc' }, take: 300, select: { path: true, event: true, label: true, meta: true, createdAt: true } }),
  ]);
  await tx.hqCustomerLink.upsert({ where: { kind_sourceId: { kind: 'session', sourceId: sessionId } }, create: { customerId, kind: 'session', sourceId: sessionId, confidence, evidence, snapshot: json({ session, views, events }) }, update: { ...(existing?.confidence !== 'confirmed' ? { confidence, evidence } : {}), snapshot: json({ session, views, events }) } });
}
export async function recordLeadCustomer(tx: DB, kind: string, lead: { id: string; phone?: string | null; email?: string | null; name?: string | null; createdAt: Date; attribution?: unknown }, capture?: { sessionId?: unknown }) {
  const customer = await customerForContact(tx, lead); if (!customer) return;
  await tx.hqCustomerLink.upsert({ where: { kind_sourceId: { kind, sourceId: lead.id } }, create: { customerId: customer.id, kind, sourceId: lead.id, confidence: 'confirmed', evidence: 'Contact supplied on saved inquiry', snapshot: json(lead) }, update: {} });
  await tx.hqCustomerEvent.upsert({ where: { sourceKey: `${kind}:${lead.id}` }, create: { customerId: customer.id, sourceKey: `${kind}:${lead.id}`, kind: 'inquiry', body: 'Website inquiry saved', occurredAt: lead.createdAt, meta: json(lead) }, update: {} });
  const attribution = normalizeAttribution(lead.attribution);
  if (attribution?.reportedSource && !customer.reportedSource) await tx.hqCustomer.update({ where: { id: customer.id }, data: { reportedSource: attribution.reportedSource } });
  const sessionId = safeId(capture?.sessionId); if (sessionId) await linkSession(tx, customer.id, sessionId, 'confirmed', 'Contact submitted from this session; identifies the inquiry, not every device user');
}
export async function matchReferences(tx: DB, customerId: string, body: string) {
  for (const code of referenceCodes(body)) {
    const ref = await tx.contactReference.findUnique({ where: { code } });
    if (ref) await linkSession(tx, customerId, ref.sessionId, 'confirmed', `Incoming message retained website reference ${code}; copied/shared references can be reviewed`);
  }
}
export async function refreshCustomerSnapshots(customerId: string) {
  const links = await prisma.hqCustomerLink.findMany({ where: { customerId, kind: 'session' } });
  for (const link of links) {
    // Do not overwrite archived evidence after anonymous retention has removed the originals.
    if (await prisma.siteView.count({ where: { sessionId: link.sourceId } })) await prisma.$transaction(tx => linkSession(tx, customerId, link.sourceId, link.confidence, link.evidence));
  }
}
