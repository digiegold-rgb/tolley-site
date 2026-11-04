import fs from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import { snapshotSchema } from '../../lib/wd-activity/core';
async function main() {
const file = process.argv[2];
if (!file) throw new Error('Usage: import.ts /private/public-snapshot.json [--apply]');
const snapshot = snapshotSchema.parse(JSON.parse(fs.readFileSync(file, 'utf8')));
console.log(JSON.stringify({ rentals: snapshot.rentals.length, events: snapshot.events.length, serviceNotes: snapshot.services.length, openSubscriptions: snapshot.openSubscriptions, apply: process.argv.includes('--apply') }));
if (process.argv.includes('--apply')) {
  const db = new PrismaClient();
  try {
    await db.$executeRawUnsafe(fs.readFileSync(path.join(process.cwd(), 'prisma/migrations/20261103010000_wd_activity/migration.sql'), 'utf8'));
    const prior = await db.$queryRaw<{ payload: unknown }[]>`SELECT payload FROM "WdActivitySnapshot" WHERE id = 'current'`;
    if (prior.length) fs.writeFileSync(file + `.backup-${Date.now()}.json`, JSON.stringify(prior[0].payload), { mode: 0o600 });
    const payload = JSON.stringify(snapshot);
    await db.$executeRaw`INSERT INTO "WdActivitySnapshot" (id, payload, "updatedAt") VALUES ('current', ${payload}::jsonb, NOW()) ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload, "updatedAt" = NOW()`;
    console.log('Public activity snapshot saved. Rental, billing and messaging records were not modified.');
  } finally { await db.$disconnect(); }
}

}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
