/**
 * scripts/apply-vater-workspaces-2026-08-27.ts
 *
 * Apply prisma/migrations/20260827_vater_workspaces/migration.sql to the
 * database in DATABASE_URL, then verify. Same shape as
 * apply-jelly-tenancy-2026-08-15.ts: dry-run by default, `--apply` to write.
 *
 *   npx tsx scripts/apply-vater-workspaces-2026-08-27.ts           # dry-run
 *   npx tsx scripts/apply-vater-workspaces-2026-08-27.ts --apply   # for real
 *
 * Purely additive (one new table, IF NOT EXISTS throughout) — safe against a
 * live database, safe to run twice, and safe in either order relative to the
 * deploy: the code probes for the table and hides the tab strip until it
 * exists (lib/vater/workspaces.ts).
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { prisma } from "../lib/prisma";
import { splitSqlStatements } from "./lib/sql-statements";

const APPLY = process.argv.includes("--apply");
const SQL = path.join(
  process.cwd(),
  "prisma/migrations/20260827_vater_workspaces/migration.sql",
);

async function tableExists(table: string): Promise<boolean> {
  const rows = await prisma.$queryRaw<{ n: bigint }[]>`
    SELECT COUNT(*)::bigint AS n
    FROM information_schema.tables
    WHERE table_schema = current_schema() AND table_name = ${table}
  `;
  return Number(rows[0]?.n ?? 0) > 0;
}

async function main() {
  console.log(`${APPLY ? "APPLY" : "dry-run"} — ${SQL}`);
  const before = await tableExists("VaterWorkspace");
  console.log(`VaterWorkspace exists before: ${before}`);

  const statements = splitSqlStatements(readFileSync(SQL, "utf8"));
  for (const stmt of statements) {
    console.log(`${APPLY ? "→" : "[dry-run]"} ${stmt.split("\n")[0].slice(0, 90)}…`);
    if (APPLY) await prisma.$executeRawUnsafe(stmt);
  }

  const after = await tableExists("VaterWorkspace");
  console.log(`VaterWorkspace exists after: ${after}`);
  if (APPLY && !after) {
    throw new Error("migration ran but VaterWorkspace is still missing");
  }
  if (after) {
    const rows = await prisma.$queryRaw<{ n: bigint }[]>`
      SELECT COUNT(*)::bigint AS n FROM "VaterWorkspace"
    `;
    console.log(`rows: ${Number(rows[0]?.n ?? 0)} (primary tabs are inserted lazily on first /animate load)`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
