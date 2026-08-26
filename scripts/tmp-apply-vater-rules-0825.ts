// One-off (2026-08-25): apply prisma/migrations/20260825_vater_rules_online by hand
// (this repo applies migrations manually) and print before/after table presence.
import { readFileSync } from "fs";
import { prisma } from "../lib/prisma";

async function present() {
  const r = await prisma.$queryRawUnsafe<{ a: string | null; b: string | null }[]>(
    `SELECT to_regclass('"VaterRule"')::text AS a, to_regclass('"VaterRuleRevision"')::text AS b`,
  );
  return r[0];
}
async function main() {
  console.log("before:", await present());
  const sql = readFileSync("prisma/migrations/20260825_vater_rules_online/migration.sql", "utf8");
  for (const stmt of sql.replace(/--[^\n]*/g, "").split(";").map((s) => s.trim()).filter(Boolean)) {
    await prisma.$executeRawUnsafe(stmt);
  }
  console.log("after:", await present());
}
main().catch((e) => { console.error(e.message); process.exit(1); }).finally(() => prisma.$disconnect());
