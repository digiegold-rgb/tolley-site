/**
 * Seed Wayne Clark / Aramsco's recurring delivery runs as RegularRun templates.
 * Reconstructed from his 40-invoice history; mileage taken from the clean
 * post-2026-04 $3/mi entries where available (editable in the UI afterward).
 *
 * Idempotent: matches on (contactId, label) and skips runs that already exist,
 * so re-running never duplicates.
 *
 *   npx tsx scripts/seed-wayne-runs.ts
 */
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

function loadEnvFile(path: string) {
  if (!existsSync(path)) return;
  for (const raw of readFileSync(path, 'utf8').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    val = val.replace(/\\n$/, '').replace(/\s+$/, '');
    if (!(key in process.env)) process.env[key] = val;
  }
}
loadEnvFile(join(process.cwd(), '.env.local'));
loadEnvFile(join(process.cwd(), '.env.production.local'));
loadEnvFile(join(process.cwd(), '.env'));

import { prisma } from '../lib/prisma';

// Pickup for the whole route: Aramsco, 14805 W 99th St, Lenexa, KS 66215.
const RUNS: { label: string; dropLocation: string; miles: number }[] = [
  { label: 'Gaumats International — Grain Valley', dropLocation: 'Gaumats International, 1251 NW Granite Dr, Grain Valley, MO', miles: 38 },
  { label: 'Legendary Stone Arts — Independence', dropLocation: 'Legendary Stone Arts LLC, 3120 Weatherford Rd, Independence, MO', miles: 28 },
  { label: 'DL Granite & Design — Tonganoxie', dropLocation: 'DL Granite & Design, 545 Industrial Dr, Tonganoxie, KS 66086', miles: 28 },
  { label: 'Starboard West River — KC', dropLocation: 'Starboard West River, 701 Berkley Pkwy, Kansas City, MO 64120', miles: 19 },
  { label: 'Starboard Installation — Lees Summit', dropLocation: 'Starboard Installation, 2951 SE Shenandoah Dr, Lees Summit, MO 64063', miles: 27 },
  { label: "Eduardo's KC Granite", dropLocation: "Eduardo's KC Granite Countertops", miles: 19 },
  { label: 'Elite Granite — Osage', dropLocation: 'Elite Granite, Osage Ave, Kansas City, KS', miles: 15 },
  { label: '428 Osage Ave — KCK', dropLocation: '428 Osage Ave, Kansas City, KS 66105', miles: 15 },
  { label: 'Any Top Shop', dropLocation: 'Any Top Shop', miles: 12 },
  { label: 'Summit Stone Works — North KC', dropLocation: 'Summit Stone Works, North Kansas City, MO', miles: 19 },
  { label: 'Drexel MO (long haul)', dropLocation: 'Drexel, MO', miles: 41 },
];

async function main() {
  const contact = await prisma.accountContact.findFirst({
    where: { name: { contains: 'Wayne', mode: 'insensitive' } },
  });
  if (!contact) {
    console.error("No contact matching 'Wayne' found — aborting.");
    process.exit(1);
  }
  console.log(`Contact: ${contact.name} (${contact.id})`);

  let created = 0;
  let skipped = 0;
  for (let i = 0; i < RUNS.length; i++) {
    const r = RUNS[i];
    const exists = await prisma.regularRun.findFirst({
      where: { contactId: contact.id, label: r.label },
      select: { id: true },
    });
    if (exists) {
      skipped++;
      console.log(`  = skip  ${r.label}`);
      continue;
    }
    await prisma.regularRun.create({
      data: {
        contactId: contact.id,
        label: r.label,
        dropLocation: r.dropLocation,
        miles: r.miles,
        rate: 3,
        sortOrder: i,
      },
    });
    created++;
    console.log(`  + add   ${r.label}  (${r.miles} mi → $${(r.miles * 3).toFixed(0)})`);
  }
  console.log(`\nDone. ${created} created, ${skipped} already present.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    return prisma.$disconnect().finally(() => process.exit(1));
  });
