// One-off importer: reads a MileIQ detailed-log text file and loads it into
// the MileageTrip table. Usage: npx tsx prisma/seeds/import-mileage.ts [file]
import { readFileSync } from 'fs';
import { PrismaClient } from '@prisma/client';
import { parseMileIqLog, summarize } from '../../lib/account/mileage';

const prisma = new PrismaClient();

async function main() {
  const file = process.argv[2] || 'prisma/seeds/mileage-2026.txt';
  const raw = readFileSync(file, 'utf8');
  const { trips, skipped } = parseMileIqLog(raw);
  const res = await prisma.mileageTrip.createMany({ data: trips, skipDuplicates: true });
  const s = summarize(trips);
  console.log(JSON.stringify({
    file,
    parsed: trips.length,
    inserted: res.count,
    skipped,
    businessMiles: s.businessMiles,
    businessDeduction: s.businessDeduction,
    totalDeduction: s.totalDeduction,
  }, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
