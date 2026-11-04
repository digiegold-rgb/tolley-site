import fs from 'node:fs';
import path from 'node:path';
import Stripe from 'stripe';
import { PrismaClient } from '@prisma/client';
import { isWdSubscription } from '../../lib/wd-product';
import { buildSnapshot } from '../../lib/wd-activity/project';
// Reads only. No existing sync functions: those can create customers and drafts.
async function main() {
const dir = process.argv[2];
if (!dir || !path.isAbsolute(dir)) throw new Error('Pass an absolute private output directory');
fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
const db = new PrismaClient();
try {
  const clients = await db.wdClient.findMany({ select: { id: true, name: true, address: true, unitDescription: true, installDate: true, notes: true, stripeCustomerId: true, stripeSubscriptionId: true } });
  const repairs = await db.wdRepairItem.findMany({ select: { name: true } });
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  const subs = (await stripe.subscriptions.list({ limit: 100, status: 'all' }).autoPagingToArray({ limit: 10000 })).filter(isWdSubscription);
  const subscriptions = subs.map(s => ({ id: s.id, customer: typeof s.customer === 'string' ? s.customer : s.customer.id, status: s.status, start: s.start_date }));
  const ids = [...new Set(subscriptions.map(s => s.customer))], customers: Record<string, { name: string | null }> = {};
  let cursor = 0;
  await Promise.all(Array.from({ length: 5 }, async () => {
    for (;;) { const id = ids[cursor++]; if (!id) return; const c = await stripe.customers.retrieve(id); customers[id] = { name: 'deleted' in c ? null : c.name }; }
  }));
  const source = { clients, repairs, subscriptions, customers, asOf: new Date().toISOString() };
  fs.writeFileSync(path.join(dir, 'private-source.json'), JSON.stringify(source, null, 2), { mode: 0o600 });
  const snapshot = buildSnapshot(source);
  fs.writeFileSync(path.join(dir, 'public-snapshot.json'), JSON.stringify(snapshot, null, 2), { mode: 0o600 });
  console.log(JSON.stringify({ rentals: snapshot.rentals.length, datedInstalls: snapshot.events.filter(e => e.kind === 'installation').length, subscriptionStarts: snapshot.events.filter(e => e.kind === 'signup').length, areas: new Set(snapshot.rentals.map(r => r.areaId).filter(Boolean)).size, serviceNotes: snapshot.services.length }));
} finally { await db.$disconnect(); }

}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
