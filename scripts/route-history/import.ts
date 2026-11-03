/** Import a reviewed extraction snapshot without changing billing or corrections.
 * node --env-file=... --import tsx scripts/route-history/import.ts /private/archive.json [--apply]
 */
import fs from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import { validDate, type Archive } from '../../lib/route-history/core';
async function main() {
const input = process.argv[2];
if (!input) throw new Error('Provide the private archive JSON path');
const data = JSON.parse(fs.readFileSync(input, 'utf8')) as Archive;
if (data.version !== 1 || !Array.isArray(data.deliveries) || !data.importedAt) throw new Error('Invalid archive');
const ids = new Set<string>();
for (const d of data.deliveries) {
  if (!d.id || ids.has(d.id) || !d.sources.length || (d.date !== null && !validDate(d.date)) || (d.weightLbs !== null && (!Number.isFinite(d.weightLbs) || d.weightLbs < 0))) throw new Error(`Invalid or duplicate record ${d.id}`);
  ids.add(d.id);
}
console.log(JSON.stringify({ records: ids.size, dated: data.deliveries.filter(d => d.date).length, weighed: data.deliveries.filter(d => d.weightLbs !== null).length, apply: process.argv.includes('--apply') }));
if (process.argv.includes('--apply')) {
  const db = new PrismaClient();
  try {
    const schema = fs.readFileSync(path.resolve('prisma/migrations/20261103000000_route_history/migration.sql'), 'utf8');
    // Deliberately additive: never use db push against the production schema.
    for (const statement of schema.split(';').filter(s => s.trim())) await db.$executeRawUnsafe(statement);
    const previous = await db.$queryRaw<{ payload: Archive }[]>`SELECT payload FROM "RouteArchive" WHERE id = 'deliveries'`;
    if (previous.length) fs.writeFileSync(input + '.previous-' + Date.now() + '.json', JSON.stringify(previous[0].payload), { mode: 0o600 });
    const payload = JSON.stringify(data);
    await db.$executeRaw`INSERT INTO "RouteArchive" (id, payload, "updatedAt") VALUES ('deliveries', ${payload}::jsonb, NOW()) ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload, "updatedAt" = NOW()`;
    console.log('Archive saved; owner corrections retained.');
  } finally { await db.$disconnect(); }
}

}
main().catch(error => { console.error(error instanceof Error ? error.message : "Import failed"); process.exitCode = 1; });
