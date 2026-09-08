/** Review by default; applies ONLY the additive revenue migration in one transaction. */
import { PrismaClient } from "@prisma/client";
import { readFileSync, writeFileSync } from "node:fs";
const prisma = new PrismaClient();
const apply = process.argv.includes("--apply");
const snapshotIndex = process.argv.indexOf("--snapshot");
const snapshot = snapshotIndex >= 0 ? process.argv[snapshotIndex + 1] : null;
const addedColumns = new Set([
  "LeadAction.requestKey", "WdPayment.paidAtSource", "WdPayment.failureAttempts",
  "WdClient.monthlyAmount", "WdClient.stripeSyncedAt", "SiteView.audience", "SiteView.sessionId",
  "SiteView.campaign", "SiteEvent.sessionId", "SiteEvent.eventKey",
]);
async function main() {
  const columns = await prisma.$queryRaw<{ table_name: string; column_name: string; data_type: string; is_nullable: string; column_default: string | null }[]>`
    SELECT table_name, column_name, data_type, is_nullable, column_default FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name IN ('LeadAction', 'WdPayment', 'WdClient', 'SiteView', 'SiteEvent', 'LeadNotification')
    ORDER BY table_name, ordinal_position`;
  const existing = columns.filter(c => addedColumns.has(`${c.table_name}.${c.column_name}`));
  const notificationColumns = columns.filter(c => c.table_name === "LeadNotification");
  if (existing.length === addedColumns.size && notificationColumns.length === 12) {
    console.log(JSON.stringify({ mode: "review", schema: "present", writes: 0 })); return;
  }
  if (existing.length || notificationColumns.length) throw new Error("Partial revenue schema detected; review required before applying");
  if (new Set(columns.map(c => c.table_name)).size !== 5) throw new Error("Required baseline tables missing");
  if (!apply) { console.log(JSON.stringify({ mode: "review", schema: "ready_for_additive_migration", addedColumns: 10, addedTables: 1, writes: 0 })); return; }
  if (!snapshot?.startsWith("/")) throw new Error("--apply requires an absolute --snapshot path");
  const sql = readFileSync("prisma/migrations/20260908020000_revenue_repair/migration.sql", "utf8");
  writeFileSync(snapshot, JSON.stringify({ capturedAt: new Date(), columns, migration: sql }, null, 2), { flag: "wx", mode: 0o600 });
  await prisma.$transaction(async tx => {
    await tx.$executeRawUnsafe("SET LOCAL lock_timeout = '5s'");
    await tx.$executeRawUnsafe("SET LOCAL statement_timeout = '30s'");
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('tolley-revenue-migration-20260908'))`;
    for (const statement of sql.split(";").map(s => s.trim()).filter(Boolean)) await tx.$executeRawUnsafe(statement);
  }, { timeout: 60000 });
  console.log(JSON.stringify({ mode: "apply", schema: "applied", addedColumns: 10, addedTables: 1, existingRowsDeleted: 0,
    next: "Record 20260908020000_revenue_repair as applied with Prisma migrate resolve, then deploy the reviewed release." }));
}
main().catch(e => { console.error(e instanceof Error && /^(Partial|Required|--apply)/.test(e.message) ? e.message : "Migration failed; transaction rolled back if not committed. Check connectivity, locks, and snapshot path."); process.exitCode = 1; }).finally(() => prisma.$disconnect());
