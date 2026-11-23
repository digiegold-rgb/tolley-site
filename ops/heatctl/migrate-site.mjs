// Additive, rerunnable planner migration. DATABASE_URL stays in the environment.
import { readFile } from 'node:fs/promises';
import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();
try {
  const counts = () => Promise.all([db.heatSnapshot.count(), db.heatDay.count(), db.heatReview.count()]);
  const before = await counts();
  const sql = await readFile(new URL('../../prisma/migrations/20261123190000_heat_planner/migration.sql', import.meta.url), 'utf8');
  await db.$transaction(async tx => {
    for (const statement of sql.split(';').map(s => s.trim()).filter(Boolean)) await tx.$executeRawUnsafe(statement);
  });
  const after = await counts();
  if (after.some((n, i) => n < before[i])) throw new Error('Existing heat record count decreased');
  console.log(JSON.stringify({ migration: 'heat_planner', existingRowsBefore: before, existingRowsAfter: after, additive: true }));
} finally { await db.$disconnect(); }
