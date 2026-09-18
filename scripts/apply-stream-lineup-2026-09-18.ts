/**
 * scripts/apply-stream-lineup-2026-09-18.ts
 *
 * Apply prisma/migrations/20260918_stream_lineup/migration.sql to the database
 * in DATABASE_URL, then verify. Dry-run by default, `--apply` writes.
 *
 *   npx tsx scripts/apply-stream-lineup-2026-09-18.ts           # dry-run
 *   npx tsx scripts/apply-stream-lineup-2026-09-18.ts --apply   # for real
 *
 * Additive (two new tables, IF NOT EXISTS) — safe on a live database and safe
 * to run twice. Must land BEFORE the code deploy.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { prisma } from "../lib/prisma";
import { splitSqlStatements } from "./lib/sql-statements";

const APPLY = process.argv.includes("--apply");
const SQL = path.join(process.cwd(), "prisma/migrations/20260918_stream_lineup/migration.sql");
const TABLES = ["StreamLineup", "StreamLineupItem"];

async function tableExists(table: string): Promise<boolean> {
  const rows = await prisma.$queryRaw<{ n: bigint }[]>`
    SELECT COUNT(*)::bigint AS n
    FROM information_schema.tables
    WHERE table_schema = current_schema()
      AND table_name = ${table}
  `;
  return Number(rows[0]?.n ?? 0) > 0;
}

async function main() {
  console.log(`${APPLY ? "APPLY" : "dry-run"} — ${SQL}`);
  for (const t of TABLES) console.log(`${t} exists before: ${await tableExists(t)}`);
  for (const stmt of splitSqlStatements(readFileSync(SQL, "utf8"))) {
    console.log(`${APPLY ? "→" : "[dry-run]"} ${stmt.split("\n")[0].slice(0, 90)}…`);
    if (APPLY) await prisma.$executeRawUnsafe(stmt);
  }
  for (const t of TABLES) {
    const after = await tableExists(t);
    console.log(`${t} exists after: ${after}`);
    if (APPLY && !after) throw new Error(`${t} still missing after apply`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
