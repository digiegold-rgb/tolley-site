import { prisma } from '@/lib/prisma';
import { refreshCustomerSnapshots } from './store';
/** Daily aggregation precedes deletion in the same transaction. Financial records
 * and saved customer evidence are separate tables and never purged here. */
export async function retainCustomerHistory(now = new Date()) {
  const cutoff = new Date(now); cutoff.setUTCFullYear(cutoff.getUTCFullYear() - 1); cutoff.setUTCHours(0, 0, 0, 0);
  const linked = await prisma.hqCustomer.findMany({ where: { deletedAt: null, links: { some: { kind: 'session' } } }, select: { id: true } });
  for (const c of linked) await refreshCustomerSnapshots(c.id);
  return prisma.$transaction(async tx => {
    await tx.$executeRaw`
      INSERT INTO "SiteDailyTotal" ("day", "site", "views", "events", "sessions")
      SELECT day, site, SUM(views)::integer, SUM(events)::integer, COUNT(DISTINCT session)::integer
      FROM (
        SELECT to_char("createdAt" AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS day, site, 1 AS views, 0 AS events, "sessionId" AS session FROM "SiteView" WHERE "createdAt" < ${cutoff} AND audience = 'anonymous'
        UNION ALL
        SELECT to_char("createdAt" AT TIME ZONE 'UTC', 'YYYY-MM-DD'), site, 0, 1, "sessionId" FROM "SiteEvent" WHERE "createdAt" < ${cutoff} AND audience = 'anonymous'
      ) rows GROUP BY day, site
      ON CONFLICT (day, site) DO UPDATE SET views = "SiteDailyTotal".views + EXCLUDED.views, events = "SiteDailyTotal".events + EXCLUDED.events, sessions = "SiteDailyTotal".sessions + EXCLUDED.sessions`;
    const views = await tx.siteView.deleteMany({ where: { createdAt: { lt: cutoff }, audience: 'anonymous' } });
    const events = await tx.siteEvent.deleteMany({ where: { createdAt: { lt: cutoff }, audience: 'anonymous' } });
    await tx.visitorSession.deleteMany({ where: { lastSeenAt: { lt: cutoff } } });
    await tx.contactReference.deleteMany({ where: { createdAt: { lt: cutoff } } });
    const expired = await tx.hqCustomer.findMany({ where: { closedAt: { lt: cutoff }, deletedAt: null }, select: { id: true } });
    for (const c of expired) {
      await tx.hqPhoneThread.updateMany({ where: { customerId: c.id }, data: { status: 'deleted', checkpoint: null, name: null } });
      await tx.hqCustomerEvent.deleteMany({ where: { customerId: c.id } });
      await tx.hqCustomerLink.deleteMany({ where: { customerId: c.id } });
      await tx.hqCustomer.update({ where: { id: c.id }, data: { deletedAt: now, name: null, notes: null, reportedSource: null } });
    }
    return { views: views.count, events: events.count, customers: expired.length };
  }, { timeout: 60000 });
}
