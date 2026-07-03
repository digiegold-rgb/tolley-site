// Standalone CLI mirror of app/api/shop/admin/revenue/import/route.ts.
// Reuses the SAME parseRevenueWorkbook parser so parsing is identical to the
// web import, and the SAME dedup/upsert + Totals-replace logic. Bypasses the
// shop-admin HTTP auth so we can drive it from the DGX box.
//
// Usage:
//   node scripts/import-revenue-cli.ts "<path-to.xlsx>" --dry
//   node scripts/import-revenue-cli.ts "<path-to.xlsx>"        (commit)

import { readFileSync } from "fs";
import { PrismaClient } from "@prisma/client";
import { parseRevenueWorkbook } from "../lib/shop/revenue-import.ts";

async function main() {
  const filePath = process.argv[2];
  const dryRun = process.argv.includes("--dry");
  if (!filePath) {
    console.error("Usage: node scripts/import-revenue-cli.ts <file.xlsx> [--dry]");
    process.exit(1);
  }

  const fileName = filePath.split("/").pop() || filePath;
  const buffer = readFileSync(filePath);
  const parsed = parseRevenueWorkbook(buffer, fileName);

  console.log(`\n=== Parse: ${fileName} ===`);
  console.log(`sheets=${parsed.sheetCount}  entries=${parsed.entries.length}  skipped=${parsed.skippedSheets.length}`);
  console.log("\nby business:");
  for (const [b, n] of Object.entries(parsed.byBusiness)) console.log(`  ${b.padEnd(22)} ${n} rows`);
  console.log("\nofficial Totals tabs parsed:");
  for (const t of parsed.businessTotals) {
    console.log(`  ${t.business.padEnd(22)} gross=${t.gross} cost=${t.cost} profit=${t.profit} opt=${t.profitOptimistic} inv=${t.inventoryRem}  [${t.sourceSheet}]`);
  }
  console.log("\nskipped sheets:");
  for (const s of parsed.skippedSheets) console.log(`  ${s.name} — ${s.reason}`);

  if (dryRun) {
    console.log("\n[DRY RUN] no DB writes.");
    return;
  }

  const prisma = new PrismaClient();
  try {
    const batch = await prisma.revenueImportBatch.create({
      data: {
        sourceFile: fileName,
        sheetCount: parsed.sheetCount,
        rowsImported: 0,
        rowsSkipped: parsed.skippedSheets.length,
      },
    });

    // Totals tabs are authoritative — replace this file's totals.
    await prisma.revenueBusinessTotals.deleteMany({ where: { sourceFile: fileName } });
    for (const t of parsed.businessTotals) {
      await prisma.revenueBusinessTotals.create({
        data: {
          business: t.business,
          sourceFile: fileName,
          sourceSheet: t.sourceSheet,
          gross: t.gross ?? null,
          cost: t.cost ?? null,
          profit: t.profit ?? null,
          profitOptimistic: t.profitOptimistic ?? null,
          inventoryRem: t.inventoryRem ?? null,
          importBatchId: batch.id,
        },
      });
    }

    let imported = 0;
    let updated = 0;
    for (const e of parsed.entries) {
      const existing = await prisma.revenueEntry.findUnique({
        where: { dedupKey: e.dedupKey },
        select: { id: true },
      });
      if (existing) {
        await prisma.revenueEntry.update({
          where: { id: existing.id },
          data: {
            business: e.business, channel: e.channel, itemDesc: e.itemDesc,
            date: e.date, gross: e.gross, cost: e.cost, fees: e.fees,
            profit: e.profit, inventoryRem: e.inventoryRem, notes: e.notes,
            sourceFile: e.sourceFile, sourceSheet: e.sourceSheet,
            sourceRowIdx: e.sourceRowIdx, importBatchId: batch.id,
          },
        });
        updated++;
      } else {
        await prisma.revenueEntry.create({ data: { ...e, importBatchId: batch.id } });
        imported++;
      }
    }

    await prisma.revenueImportBatch.update({
      where: { id: batch.id },
      data: { rowsImported: imported, rowsUpdated: updated },
    });

    console.log(`\n✓ COMMITTED batch ${batch.id}: ${imported} new + ${updated} updated rows`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error("IMPORT FAILED:", e);
  process.exit(1);
});
