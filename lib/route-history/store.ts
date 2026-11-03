import 'server-only';
import { prisma } from '@/lib/prisma';
import { applyCorrection, emptyArchive, type Archive, type Correction } from './core';
export async function readArchive(): Promise<Archive> {
  const [snapshots, corrections] = await Promise.all([
    prisma.$queryRaw<{ payload: Archive }[]>`SELECT payload FROM "RouteArchive" WHERE id = 'deliveries'`,
    prisma.$queryRaw<{ recordId: string; changes: Correction }[]>`SELECT "recordId", changes FROM "RouteDeliveryCorrection"`,
  ]);
  const archive = snapshots[0]?.payload || emptyArchive;
  const byId = new Map(corrections.map(c => [c.recordId, c.changes]));
  return { ...archive, deliveries: archive.deliveries.map(d => byId.has(d.id) ? applyCorrection(d, byId.get(d.id)!) : d) };
}
export async function saveCorrection(recordId: string, changes: Correction) {
  const json = JSON.stringify(changes);
  await prisma.$executeRaw`INSERT INTO "RouteDeliveryCorrection" ("recordId", changes, "updatedAt") VALUES (${recordId}, ${json}::jsonb, NOW()) ON CONFLICT ("recordId") DO UPDATE SET changes = "RouteDeliveryCorrection".changes || EXCLUDED.changes, "updatedAt" = NOW()`;
}
