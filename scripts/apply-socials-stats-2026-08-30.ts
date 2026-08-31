/**
 * scripts/apply-socials-stats-2026-08-30.ts
 *
 * Apply prisma/migrations/20260830_socials_stats/migration.sql to the
 * database in DATABASE_URL, then verify. Same shape as
 * apply-vater-workspaces-2026-08-27.ts: dry-run by default, `--apply` to write.
 *
 *   npx tsx scripts/apply-socials-stats-2026-08-30.ts           # dry-run
 *   npx tsx scripts/apply-socials-stats-2026-08-30.ts --apply   # for real
 *
 * Purely additive (two new tables + one optional column, IF NOT EXISTS
 * throughout) — safe against a live database, safe to run twice, and safe
 * in either order relative to the deploy: the code probes for the tables
 * and serves empty stats until they exist.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { prisma } from "../lib/prisma";
import { splitSqlStatements } from "./lib/sql-statements";

const APPLY = process.argv.includes("--apply");
const SQL = path.join(
  process.cwd(),
  "prisma/migrations/20260830_socials_stats/migration.sql",
);

async function tableExists(table: string): Promise<boolean> {
  const rows = await prisma.$queryRaw<{ n: bigint }[]>`
    SELECT COUNT(*)::bigint AS n
    FROM information_schema.tables
    WHERE table_schema = current_schema() AND table_name = ${table}
  `;
  return Number(rows[0]?.n ?? 0) > 0;
}

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
  const beforeChannel = await tableExists("SocialChannelStat");
  const beforePost = await tableExists("SocialPostStat");
  const beforeBatch = await columnExists("VaterSocialPost", "batchId");
  console.log(`SocialChannelStat exists before: ${beforeChannel}`);
  console.log(`SocialPostStat exists before: ${beforePost}`);
  console.log(`VaterSocialPost.batchId exists before: ${beforeBatch}`);

  const statements = splitSqlStatements(readFileSync(SQL, "utf8"));
  for (const stmt of statements) {
    console.log(`${APPLY ? "→" : "[dry-run]"} ${stmt.split("\n")[0].slice(0, 90)}…`);
    if (APPLY) await prisma.$executeRawUnsafe(stmt);
  }

  const afterChannel = await tableExists("SocialChannelStat");
  const afterPost = await tableExists("SocialPostStat");
  const afterBatch = await columnExists("VaterSocialPost", "batchId");
  console.log(`SocialChannelStat exists after: ${afterChannel}`);
  console.log(`SocialPostStat exists after: ${afterPost}`);
  console.log(`VaterSocialPost.batchId exists after: ${afterBatch}`);
  if (APPLY && (!afterChannel || !afterPost)) {
    throw new Error("migration ran but SocialChannelStat / SocialPostStat is still missing");
  }
  if (afterChannel) {
    const rows = await prisma.$queryRaw<{ n: bigint }[]>`
      SELECT COUNT(*)::bigint AS n FROM "SocialChannelStat"
    `;
    console.log(`SocialChannelStat rows: ${Number(rows[0]?.n ?? 0)}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
