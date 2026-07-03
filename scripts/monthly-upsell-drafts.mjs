#!/usr/bin/env node
/**
 * Monthly warm-upsell DRAFTS for existing clients — Engine 5 (cash floor).
 * Runs 1st of month 09:00 America/Chicago via growth-upsell.timer.
 * Run from inside tolley-site: node --env-file=.env.local scripts/monthly-upsell-drafts.mjs
 *
 * Creates one GrowthTouch DRAFT each for Buckeye and Wayne. DRAFTS ONLY —
 * no send mechanism exists; they surface in the tolley.io/hq approval queue.
 * Hard rule: messages to existing clients are draft→approve FOREVER.
 *
 * Idempotent: skips a lead if a monthly-upsell draft touch already exists
 * for it this calendar month (createdAt check).
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const TARGETS = [
  {
    name: 'Buckeye Cleaning Center',
    lead: { offer: 'delivery', stage: 'client', city: 'Kansas City', email: 'ABorden@buckeyeinternational.com' },
    subject: 'Anything else we can take off your plate?',
    body: `Hi Alicia and Anthony,

Hope the month is off to a good start. The weekly routes have been running smoothly on our end, and we wanted to check in — if there are any additional routes, locations, or one-off runs you'd like covered, we have room to take more on.

No pressure at all; just want to make sure you know the capacity is there if it'd help.

Thanks as always,
Jared Tolley
jared@yourkchomes.com`,
  },
  {
    name: 'Wayne Clark / Aramsco',
    lead: { offer: 'delivery', stage: 'client' },
    subject: 'Quick check-in (and a credit on your account)',
    body: `Hi Wayne,

Just checking in — everything been arriving on time and in good shape? If there's anything more we can help with on the delivery side, happy to take it on.

One housekeeping note: you have a $51 credit on your account (from the INV-0144 double-charge), and it will be applied to your next invoice automatically — no action needed on your end.

Thanks for the continued business,
Jared Tolley
jared@yourkchomes.com`,
  },
];

function monthStart(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

let created = 0;
let skipped = 0;

for (const t of TARGETS) {
  // Find by name, create if missing
  let lead = await prisma.growthLead.findFirst({ where: { name: t.name } });
  if (!lead) {
    lead = await prisma.growthLead.create({
      data: { name: t.name, source: 'manual', emailSource: 'manual', ...t.lead },
    });
    console.log(`[upsell] created GrowthLead "${t.name}" (${lead.id})`);
  } else {
    console.log(`[upsell] found GrowthLead "${t.name}" (${lead.id}, stage=${lead.stage})`);
  }

  // Idempotency: one upsell draft per lead per calendar month
  const existing = await prisma.growthTouch.findFirst({
    where: {
      leadId: lead.id,
      createdAt: { gte: monthStart() },
      status: 'draft',
      channel: 'email',
    },
  });
  if (existing) {
    console.log(`[upsell] SKIP "${t.name}" — draft touch ${existing.id} already exists this month (${existing.createdAt.toISOString()})`);
    skipped++;
    continue;
  }

  const touch = await prisma.growthTouch.create({
    data: {
      leadId: lead.id,
      channel: 'email',
      direction: 'out',
      status: 'draft',
      subject: t.subject,
      body: t.body,
      meta: { source: 'monthly-upsell', engine: 'engine-5-cash-floor' },
    },
  });
  console.log(`[upsell] DRAFT created for "${t.name}" — touch ${touch.id}`);
  created++;
}

console.log(`[upsell] done: ${created} drafts created, ${skipped} skipped (already drafted this month)`);
await prisma.$disconnect();
