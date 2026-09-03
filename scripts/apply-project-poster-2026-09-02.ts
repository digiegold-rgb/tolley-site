/**
 * scripts/apply-project-poster-2026-09-02.ts
 *
 * Apply prisma/migrations/20260902_project_poster/migration.sql to the
 * database in DATABASE_URL, then verify. Dry-run by default, `--apply` writes.
 *
 *   npx tsx scripts/apply-project-poster-2026-09-02.ts           # dry-run
 *   npx tsx scripts/apply-project-poster-2026-09-02.ts --apply   # for real
 *
 * Additive (one nullable column, IF NOT EXISTS) — safe on a live database and
 * safe to run twice. Must land BEFORE the code deploy: the Library list route
 * reads YouTubeProject with no select, so a client that knows the column
 * would 500 until it exists.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { prisma } from "../lib/prisma";
import { splitSqlStatements } from "./lib/sql-statements";

const APPLY = process.argv.includes("--apply");
const SQL = path.join(process.cwd(), "prisma/migrations/20260902_project_poster/migration.sql");

async function columnExists(table: string, column: string): Promise<boolean> {
  const rows = await prisma.$queryRaw<{ n: bigint }[]>`
    SELECT COUNT(*)::bigint AS n
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = ${table}
      AND column_name = ${column}
  `;
  return Number(rows[0]?.n ?? 0) > 0;
}

async function main() {
  console.log(`${APPLY ? "APPLY" : "dry-run"} — ${SQL}`);
  console.log(`YouTubeProject.posterUrl exists before: ${await columnExists("YouTubeProject", "posterUrl")}`);
  for (const stmt of splitSqlStatements(readFileSync(SQL, "utf8"))) {
    console.log(`${APPLY ? "→" : "[dry-run]"} ${stmt.split("\n")[0].slice(0, 90)}…`);
    if (APPLY) await prisma.$executeRawUnsafe(stmt);
  }
  const after = await columnExists("YouTubeProject", "posterUrl");
  console.log(`YouTubeProject.posterUrl exists after: ${after}`);
  if (APPLY && !after) throw new Error("posterUrl column still missing after apply");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
