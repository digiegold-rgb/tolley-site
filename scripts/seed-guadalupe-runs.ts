/**
 * Seed the Guadalupe Centers monthly delivery run as FLAT (weight-based)
 * RegularRun templates. Reconstructed from past invoices (INV-145 Apr 2026 is
 * the most recent complete run: 12 building drops at $22 each). Guadalupe is
 * billed once a month, flat per-drop, $16.50–$26 depending on the load — so
 * each run defaults to $22 and is adjusted for the month before sending.
 *
 * Building NAME is what matters (not the address); labels are the building.
 * Idempotent: matches on (contactId, label), skips existing. Re-run is a no-op.
 *
 *   npx tsx scripts/seed-guadalupe-runs.ts
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

const DEFAULT = 22; // typical per-drop; adjust per month by load

// Building drops for the monthly Guadalupe Centers run. dropLocation prints on
// the invoice line (building name first, address kept where we have it).
const RUNS: { label: string; dropLocation: string; notes?: string }[] = [
  { label: 'Guadalupe Centers Admin', dropLocation: 'Guadalupe Centers - Admin Building (CC Shop)' },
  { label: 'Casa Feliz', dropLocation: 'Guadalupe Casa Shop - Feliz, 2640 Belleview Ave, Kansas City, MO 64108' },
  { label: 'Guadalupe Middle School', dropLocation: 'Guadalupe Centers Middle School, 2640 Belleview Ave, Kansas City, MO 64108' },
  { label: 'Guadalupe High School', dropLocation: 'Guadalupe High School' },
  { label: 'Zartman Hall (Pre-K)', dropLocation: 'Zartman Hall - Pre K' },
  { label: 'Holter', dropLocation: 'Holter - Small Second Shop, 5201 E Truman Rd' },
  { label: 'Chapel', dropLocation: 'Chapel, 5111 E Truman Rd, Kansas City, MO 64127' },
  { label: 'Kansas Winger', dropLocation: 'Kansas Winger / Niger, 5123 E Truman Rd', notes: 'Library upper side — use Chapel' },
  { label: 'GES Library', dropLocation: 'GES Library' },
  { label: 'GC Early Childhood Center', dropLocation: 'Thomas Rogue - GC Early Childhood Center, 3800 E 51st St, Kansas City, MO 64130' },
  { label: 'Girls Preparatory Academy', dropLocation: 'Kansas City Girls Preparatory Academy, 5000 E 17th St, Kansas City, MO 64127', notes: 'Not Guadalupe Centers — same monthly run' },
  { label: 'Youth Rec', dropLocation: 'Guadalupe Youth Rec' },
];

async function main() {
  const contact = await prisma.accountContact.findFirst({
    where: { name: { equals: 'Guadalupe', mode: 'insensitive' } },
  });
  if (!contact) {
    console.error("No 'Guadalupe' contact found — aborting.");
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
        billingMode: 'FLAT',
        miles: 1,
        rate: DEFAULT,
        notes: r.notes ?? null,
        sortOrder: i,
      },
    });
    created++;
    console.log(`  + add   ${r.label}  ($${DEFAULT} default)`);
  }
  console.log(`\nDone. ${created} created, ${skipped} already present. Monthly total ≈ $${(RUNS.length * DEFAULT).toFixed(0)} at $${DEFAULT}/drop.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    return prisma.$disconnect().finally(() => process.exit(1));
  });
