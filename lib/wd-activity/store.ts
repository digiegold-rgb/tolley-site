import 'server-only';
import { prisma } from '@/lib/prisma';
import { snapshotSchema } from './core';
export async function readWdActivity() {
  const rows = await prisma.$queryRaw<{ payload: unknown }[]>`SELECT payload FROM "WdActivitySnapshot" WHERE id = 'current'`;
  if (!rows.length) throw new Error('Activity is not available yet');
  // Strict allowlist: unexpected fields fail closed instead of leaking private data.
  return snapshotSchema.parse(rows[0].payload);
}
