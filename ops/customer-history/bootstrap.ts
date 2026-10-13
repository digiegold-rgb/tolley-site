/** Imports reviewed owner facts from a private JSON file. Idempotent; no sends. */
import fs from 'node:fs';
import { prisma } from '../../lib/prisma';
import { customerForContact, linkSession, recordLeadCustomer } from '../../lib/customer-history/store';
type Seed = { key: string; phone: string; name?: string; notes: string; stage: string; discoveryStage: string; at: string; sessionAt: string; evidence: string; threadId: string };
async function main() {
  const rows: Seed[] = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  for (const row of rows) await prisma.$transaction(async tx => {
    const customer = await customerForContact(tx, row); if (!customer) return;
    if (!customer.notes) await tx.hqCustomer.update({ where: { id: customer.id }, data: { notes: row.notes } });
    const lead = await tx.growthLead.upsert({ where: { id: `phone-referral:${row.key}` }, create: { id: `phone-referral:${row.key}`, name: row.name || 'Name not yet provided', phone: row.phone, offer: 'cleanouts', source: 'manual-discovery', stage: row.stage, discoveryStage: row.discoveryStage, notes: row.notes, createdAt: new Date(row.at) }, update: {} });
    await recordLeadCustomer(tx, 'growth', lead);
    await tx.hqPhoneThread.upsert({ where: { id: row.threadId }, create: { id: row.threadId, phone: row.phone, name: row.name, customerId: customer.id, status: 'selected', lastMessageAt: new Date(row.at) }, update: {} });
    const view = await tx.siteView.findFirst({ where: { path: '/cleanouts', createdAt: { gte: new Date(Date.parse(row.sessionAt) - 1000), lte: new Date(Date.parse(row.sessionAt) + 1000) } } });
    if (view?.sessionId) await linkSession(tx, customer.id, view.sessionId, 'probable', row.evidence);
    await tx.hqCustomerEvent.upsert({ where: { sourceKey: `owner-bootstrap:${row.key}` }, create: { customerId: customer.id, sourceKey: `owner-bootstrap:${row.key}`, kind: 'owner_note', body: row.notes, occurredAt: new Date(row.at), meta: { source: 'Owner conversation and read-only phone/site review, October 12–13 2026', importedAt: new Date().toISOString() } }, update: {} });
  }, { timeout: 60000 });
  console.log(JSON.stringify({ imported: rows.length, notifications: 0 }));
}
main().finally(() => prisma.$disconnect());
