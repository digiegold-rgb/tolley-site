import "server-only";

import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";

const MIGRATION_NAME = "20261121210000_heat_loft_fan";
/** SHA-256 of prisma/migrations/20261121210000_heat_loft_fan/migration.sql */
const MIGRATION_CHECKSUM = "5993f124492bd8ac63d518d5211c19873ef4c32359072fb3a26196c9489844c7";

const STATEMENTS = [
  `ALTER TABLE "HeatSnapshot" ADD COLUMN IF NOT EXISTS "loftFanOn" BOOLEAN`,
  `ALTER TABLE "HeatSnapshot" ADD COLUMN IF NOT EXISTS "loftFanW" DOUBLE PRECISION`,
  `ALTER TABLE "HeatSnapshot" ADD COLUMN IF NOT EXISTS "loftFanEnergyWh" DOUBLE PRECISION`,
  `ALTER TABLE "HeatSnapshot" ADD COLUMN IF NOT EXISTS "loftFanDecision" TEXT`,
];

let ready: Promise<void> | null = null;

/**
 * The Vercel build does not run `prisma migrate deploy` (the original heat tables
 * were applied the same way, by hand). This applies that migration's columns on
 * first use so reads and ingests work, and records it so a later migrate deploy skips it.
 */
export function ensureLoftFanColumns(): Promise<void> {
  if (!ready) {
    ready = apply().catch((error) => {
      ready = null;
      throw error;
    });
  }
  return ready;
}

async function apply(): Promise<void> {
  const present = await prisma.$queryRaw<{ column_name: string }[]>`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'HeatSnapshot'
      AND column_name = 'loftFanOn'
  `;
  if (present.length === 0) {
    for (const statement of STATEMENTS) {
      await prisma.$executeRawUnsafe(statement);
    }
  }
  await recordMigration();
}

async function recordMigration(): Promise<void> {
  try {
    const existing = await prisma.$queryRaw<{ migration_name: string }[]>`
      SELECT migration_name
      FROM "_prisma_migrations"
      WHERE migration_name = ${MIGRATION_NAME}
      LIMIT 1
    `;
    if (existing.length > 0) return;
    await prisma.$executeRaw`
      INSERT INTO "_prisma_migrations"
        ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count")
      VALUES
        (${randomUUID()}, ${MIGRATION_CHECKSUM}, NOW(), ${MIGRATION_NAME}, NULL, NULL, NOW(), 1)
    `;
  } catch (error) {
    console.warn("[heat] loft fan migration record skipped", error instanceof Error ? error.name : "error");
  }
}
