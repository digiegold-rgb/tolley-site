import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateShopAdmin } from "@/lib/shop-auth";
import { parseRevenueWorkbook } from "@/lib/shop/revenue-import";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const isAdmin = await validateShopAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  const dryRun = form?.get("dryRun") === "1";

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }
  if (!file.name.toLowerCase().endsWith(".xlsx")) {
    return NextResponse.json(
      { error: "File must be .xlsx (export from Numbers → File → Export → Excel)" },
      { status: 400 }
    );
  }
  if (file.size > 15 * 1024 * 1024) {
    return NextResponse.json({ error: "File too large (max 15 MB)" }, { status: 413 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const parsed = parseRevenueWorkbook(buffer, file.name);

  if (dryRun) {
    return NextResponse.json({
      ok: true,
      dryRun: true,
      sheetCount: parsed.sheetCount,
      entryCount: parsed.entries.length,
      byBusiness: parsed.byBusiness,
      byChannel: parsed.byChannel,
      skippedSheets: parsed.skippedSheets,
      sample: parsed.entries.slice(0, 8),
    });
  }

  const batch = await prisma.revenueImportBatch.create({
    data: {
      sourceFile: file.name,
      sheetCount: parsed.sheetCount,
      rowsImported: 0,
      rowsSkipped: parsed.skippedSheets.length,
    },
  });

  // Replace totals for this file (Totals tabs are the authoritative numbers)
  await prisma.revenueBusinessTotals.deleteMany({ where: { sourceFile: file.name } });
  for (const t of parsed.businessTotals) {
    await prisma.revenueBusinessTotals.create({
      data: {
        business: t.business,
        sourceFile: file.name,
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
          business: e.business,
          channel: e.channel,
          itemDesc: e.itemDesc,
          date: e.date,
          gross: e.gross,
          cost: e.cost,
          fees: e.fees,
          profit: e.profit,
          inventoryRem: e.inventoryRem,
          notes: e.notes,
          sourceFile: e.sourceFile,
          sourceSheet: e.sourceSheet,
          sourceRowIdx: e.sourceRowIdx,
          importBatchId: batch.id,
        },
      });
      updated++;
    } else {
      await prisma.revenueEntry.create({
        data: {
          ...e,
          importBatchId: batch.id,
        },
      });
      imported++;
    }
  }

  await prisma.revenueImportBatch.update({
    where: { id: batch.id },
    data: { rowsImported: imported, rowsUpdated: updated },
  });

  return NextResponse.json({
    ok: true,
    batchId: batch.id,
    imported,
    updated,
    skippedSheets: parsed.skippedSheets,
    byBusiness: parsed.byBusiness,
  });
}

export async function GET() {
  const isAdmin = await validateShopAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const recent = await prisma.revenueImportBatch.findMany({
    orderBy: { createdAt: "desc" },
    take: 10,
  });
  const totalEntries = await prisma.revenueEntry.count();
  return NextResponse.json({ recent, totalEntries });
}
