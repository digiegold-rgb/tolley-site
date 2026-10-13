import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { prisma } from '../lib/prisma';
import { retainCustomerHistory } from '../lib/customer-history/retention';
const url = new URL(process.env.DATABASE_URL || 'http://invalid');
if (url.hostname !== '127.0.0.1' || url.port !== '55460' || url.pathname !== '/tolley_customers') throw new Error('Isolated database required');
async function main() {
  const old = new Date('2020-01-01'), sessionId = randomUUID();
  const customer = await prisma.hqCustomer.create({ data: { name: 'Retention test' } });
  const view = await prisma.siteView.create({ data: { site: 'retention-test', path: '/homes', sessionId, createdAt: old, audience: 'anonymous' } });
  await prisma.hqCustomerLink.create({ data: { customerId: customer.id, kind: 'session', sourceId: sessionId, confidence: 'probable', evidence: 'Test fixture' } });
  const oldEvent = await prisma.siteEvent.create({ data: { site: 'retention-test', path: '/homes', sessionId, createdAt: old, audience: 'anonymous', event: 'sms_click' } });
  await retainCustomerHistory();
  assert.equal(await prisma.siteView.findUnique({ where: { id: view.id } }), null);
  assert.equal(await prisma.siteEvent.findUnique({ where: { id: oldEvent.id } }), null);
  const snapshot = (await prisma.hqCustomerLink.findUnique({ where: { kind_sourceId: { kind: 'session', sourceId: sessionId } } }))!.snapshot as { views: unknown[]; events: unknown[] };
  assert.equal(snapshot.views.length, 1); assert.equal(snapshot.events.length, 1);
  const aggregate = await prisma.siteDailyTotal.findUnique({ where: { day_site: { day: '2020-01-01', site: 'retention-test' } } });
  await retainCustomerHistory();
  assert.deepEqual(await prisma.siteDailyTotal.findUnique({ where: { day_site: { day: '2020-01-01', site: 'retention-test' } } }), aggregate, 'rerun must not double counts');
  assert.deepEqual((await prisma.hqCustomerLink.findUnique({ where: { kind_sourceId: { kind: 'session', sourceId: sessionId } } }))!.snapshot, snapshot, 'retention must not erase saved evidence');
  await prisma.hqCustomer.update({ where: { id: customer.id }, data: { closedAt: old } });
  await retainCustomerHistory();assert((await prisma.hqCustomer.findUnique({ where: { id: customer.id } }))!.deletedAt);
  console.log('Retention: atomic totals, raw purge, retained evidence, idempotence and closed-customer expiry passed');
}
main().finally(() => prisma.$disconnect());
