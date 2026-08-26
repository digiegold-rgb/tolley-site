// One-off (2026-08-25): apply prisma/migrations/20260825_vater_rule_scopes by hand
// (this repo applies migrations manually); prints the scope histogram before/after.
import { readFileSync } from "fs";
import { prisma } from "../lib/prisma";

async function hist() {
  try {
    return await prisma.$queryRawUnsafe<{ scope: string; n: number }[]>(`SELECT "scope", count(*)::int AS n FROM "VaterRule" GROUP BY 1`);
  } catch (e) { return `no scope column yet (${(e as Error).message.slice(0, 60)})`; }
}
async function main() {
  console.log("before:", await hist());
  const sql = readFileSync("prisma/migrations/20260825_vater_rule_scopes/migration.sql", "utf8");
  for (const stmt of sql.replace(/--[^\n]*/g, "").split(";").map((s) => s.trim()).filter(Boolean)) {
    await prisma.$executeRawUnsafe(stmt);
  }
  console.log("after:", await hist());
}
main().catch((e) => { console.error(e.message); process.exit(1); }).finally(() => prisma.$disconnect());
