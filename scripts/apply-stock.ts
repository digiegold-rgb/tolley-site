import { readFileSync } from "node:fs";
import { prisma } from "../lib/prisma";
import { splitSqlStatements } from "./lib/sql-statements";
const tables = [
  "StockOpportunity",
  "StockPurchase",
  "StockImport",
  "StockSync",
];
async function main() {
  try {
    const existing = await prisma.$queryRaw<
      { tablename: string }[]
    >`SELECT tablename FROM pg_tables WHERE schemaname=current_schema() AND tablename IN ('StockOpportunity','StockPurchase','StockImport','StockSync')`;
    if (existing.length === 4)
      console.log("Stock tables already present; no mutation.");
    else if (existing.length)
      throw new Error(
        "Partial stock schema detected. Inspect before applying.",
      );
    else if (!process.argv.includes("--apply"))
      console.log("Dry run: four additive stock tables will be created.");
    else {
      const statements = splitSqlStatements(
        readFileSync(
          "prisma/migrations/20260926_stream_stock/migration.sql",
          "utf8",
        ),
      );
      await prisma.$transaction(
        async (tx) => {
          for (const sql of statements) await tx.$executeRawUnsafe(sql);
        },
        { timeout: 30000 },
      );
      console.log("Created stock tables:", tables.join(", "));
    }
  } finally {
    await prisma.$disconnect();
  }
}
main().catch(() => {
  console.error(
    "Stock migration failed; no partial transaction was committed.",
  );
  process.exitCode = 1;
});
