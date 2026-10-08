import { PrismaClient } from "@prisma/client";
import { readFileSync, writeFileSync } from "node:fs";
const db = new PrismaClient();
const tables = ["ContentIncomeAccount", "ContentIncomePost", "ContentIncomeReceipt", "ContentIncomeEarningDay"];
async function main() {
  const columns = await db.$queryRaw<{ table_name: string; column_name: string; data_type: string }[]>`SELECT table_name,column_name,data_type FROM information_schema.columns WHERE table_schema=current_schema() AND table_name LIKE 'ContentIncome%' ORDER BY table_name,ordinal_position`;
  const found = new Set(columns.map(c => c.table_name));
  if (tables.every(t => found.has(t))) { console.log(JSON.stringify({ schema: "present", writes: 0 })); return; }
  if (found.size) throw new Error("Partial Content Income schema. Reconcile before applying.");
  if (!process.argv.includes("--apply")) { console.log(JSON.stringify({ schema: "ready", addedTables: tables, writes: 0 })); return; }
  const snapshot = process.argv[process.argv.indexOf("--snapshot") + 1];
  if (!snapshot?.startsWith("/")) throw new Error("Use an absolute --snapshot path");
  const sql = readFileSync("prisma/migrations/20261008000000_content_income/migration.sql", "utf8");
  if (/^\s*(DROP|DELETE|TRUNCATE|UPDATE|INSERT)\b/im.test(sql)) throw new Error("Migration must be additive only");
  writeFileSync(snapshot, JSON.stringify({ capturedAt: new Date(), columns, migration: sql }, null, 2), { flag: "wx", mode: 0o600 });
  await db.$transaction(async tx => {
    await tx.$executeRawUnsafe("SET LOCAL lock_timeout = '5s'");
    await tx.$executeRawUnsafe("SET LOCAL statement_timeout = '30s'");
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('content-income-migration-20261008'))`;
    for (const statement of sql.split(";").map(s => s.trim()).filter(Boolean)) await tx.$executeRawUnsafe(statement);
  }, { timeout: 60000 });
  console.log(JSON.stringify({ schema: "applied", existingRowsDeleted: 0, next: "Record 20261008000000_content_income with prisma migrate resolve" }));
}
main().catch(e => { console.error(e instanceof Error && /^(Partial|Use|Migration)/.test(e.message) ? e.message : "Content Income migration failed; check connection, locks and snapshot path"); process.exitCode = 1; }).finally(() => db.$disconnect());
