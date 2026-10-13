import { prisma } from '@/lib/prisma';
import { validateWdAdmin } from '@/lib/wd-auth';
import { deviceLabel } from '@/lib/customer-history/core';
import { attributionSource, normalizeAttribution } from '@/lib/discovery-attribution';
export async function GET(req: Request) {
  if (!(await validateWdAdmin()).authed) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const params = new URL(req.url).searchParams, sessionId = params.get('sessionId');
  const days = Math.max(1, Math.min(365, Number(params.get("days")) || 30));
  const since = new Date(Date.now() - days * 86400000);
  if (sessionId) {
    const [session, views, events, link] = await Promise.all([prisma.visitorSession.findUnique({ where: { id: sessionId } }), prisma.siteView.findMany({ where: { sessionId }, orderBy: { createdAt: 'asc' }, take: 500 }), prisma.siteEvent.findMany({ where: { sessionId }, orderBy: { createdAt: 'asc' }, take: 500 }), prisma.hqCustomerLink.findUnique({ where: { kind_sourceId: { kind: 'session', sourceId: sessionId } }, select: { customerId: true, confidence: true } })]);
    return Response.json({ session, views, events, link }, { headers: { 'Cache-Control': 'private, no-store' } });
  }
  const [sessions, views, events, visitors, sessionCount, inquiries, linkedCustomers] = await Promise.all([
    prisma.visitorSession.findMany({ where: { audience: 'anonymous', lastSeenAt: { gte: since } }, orderBy: [{ lastSeenAt: 'desc' }, { id: 'desc' }], take: 100, ...(params.get('cursor') ? { cursor: { id: params.get('cursor')! }, skip: 1 } : {}) }),
    prisma.siteView.count({ where: { audience: 'anonymous', createdAt: { gte: since } } }),
    prisma.siteEvent.count({ where: { audience: 'anonymous', createdAt: { gte: since } } }),
    prisma.visitorSession.groupBy({ by: ['visitorId'], where: { audience: 'anonymous', createdAt: { gte: since }, visitorId: { not: null } } }),
    prisma.visitorSession.count({ where: { audience: 'anonymous', createdAt: { gte: since } } }),
    prisma.hqCustomerLink.count({ where: { kind: { in: ['action', 'growth'] }, createdAt: { gte: since } } }),
    prisma.hqCustomer.count({ where: { deletedAt: null, links: { some: { kind: 'session', createdAt: { gte: since } } } } }),
  ]);
  return Response.json({ period: days, nextCursor: sessions.length === 100 ? sessions.at(-1)!.id : null, totals: { views, events, browserIds: visitors.length, sessions: sessionCount, inquiries, linkedCustomers }, sessions: sessions.map(s => ({ ...s, device: deviceLabel(s.userAgent), source: attributionSource(normalizeAttribution(s.latestTouch)) })) }, { headers: { 'Cache-Control': 'private, no-store' } });
}
