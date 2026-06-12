#!/usr/bin/env node
/**
 * scripts/import-amazon-earnings.mjs — Amazon Associates earnings CSV drop
 * importer. Part of the "While You Slept" passive stack.
 *
 *   node --env-file=.env.local scripts/import-amazon-earnings.mjs
 *
 * Watches ~/Shared/amazon-earnings/ for *.csv (Associates "Earnings report"
 * downloads — drop them in whenever; weekly is fine). Each row becomes a
 * RevenueEntry (business "Amazon Associates", channel = tracking ID) with a
 * stable dedupKey so re-importing the same file is a no-op. Processed files
 * move to ~/Shared/amazon-earnings/imported/.
 *
 * Column detection is defensive: Associates report layouts vary, so headers
 * are matched by substring (tracking / date / ad fees|earnings|commission /
 * revenue / name|title). A file with no recognizable columns is SKIPPED
 * loudly (moved to imported/failed/ with a .reason.txt) — never silently.
 */

import { PrismaClient } from "@prisma/client";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const prisma = new PrismaClient();
const DROP_DIR = path.join(os.homedir(), "Shared", "amazon-earnings");
const DONE_DIR = path.join(DROP_DIR, "imported");
const FAIL_DIR = path.join(DONE_DIR, "failed");

// Minimal CSV parser (handles quoted fields with commas).
function parseCsv(text) {
  const rows = [];
  let row = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"' && text[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') inQ = false;
      else cur += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === ",") { row.push(cur); cur = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cur); cur = "";
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = [];
    } else cur += ch;
  }
  if (cur !== "" || row.length) { row.push(cur); if (row.some((c) => c.trim() !== "")) rows.push(row); }
  return rows;
}

function findCol(headers, ...needles) {
  const idx = headers.findIndex((h) => needles.some((n) => h.toLowerCase().includes(n)));
  return idx >= 0 ? idx : null;
}

const money = (s) => {
  const n = parseFloat(String(s ?? "").replace(/[$,]/g, ""));
  return Number.isFinite(n) ? n : null;
};

async function importFile(file) {
  const full = path.join(DROP_DIR, file);
  const text = fs.readFileSync(full, "utf8");
  const rows = parseCsv(text);
  // Associates reports sometimes carry a preamble line before the header —
  // find the first row containing a recognizable earnings/fee column.
  let headerIdx = rows.findIndex((r) =>
    r.some((c) => /ad fees|earnings|commission/i.test(c)),
  );
  if (headerIdx < 0) {
    throw new Error("no header row with 'ad fees'/'earnings'/'commission' column found");
  }
  const headers = rows[headerIdx].map((h) => h.trim());
  const cFees = findCol(headers, "ad fees", "earnings", "commission");
  const cTracking = findCol(headers, "tracking");
  const cDate = findCol(headers, "date");
  const cName = findCol(headers, "name", "title", "product");
  const cRevenue = findCol(headers, "revenue", "price");

  let imported = 0;
  let skipped = 0;
  const batch = await prisma.revenueImportBatch.create({
    data: {
      sourceFile: `amazon-earnings/${file}`,
      sheetCount: 1,
      rowsImported: 0,
      rowsSkipped: 0,
      notes: "Amazon Associates CSV drop import",
    },
  });

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i];
    const fees = money(r[cFees]);
    if (fees === null) { skipped++; continue; }
    const dedupKey = `amazon:${file}:${i}`;
    const date = cDate !== null ? new Date(r[cDate]) : null;
    try {
      await prisma.revenueEntry.upsert({
        where: { dedupKey },
        create: {
          business: "Amazon Associates",
          channel: cTracking !== null ? r[cTracking]?.trim() || null : null,
          itemDesc: cName !== null ? r[cName]?.trim()?.slice(0, 200) || null : null,
          date: date && !Number.isNaN(date.getTime()) ? date : null,
          gross: cRevenue !== null ? money(r[cRevenue]) : null,
          profit: fees, // affiliate fees ARE the profit — no COGS
          sourceFile: `amazon-earnings/${file}`,
          sourceSheet: "csv",
          sourceRowIdx: i,
          importBatchId: batch.id,
          dedupKey,
        },
        update: { profit: fees },
      });
      imported++;
    } catch (e) {
      console.error(`  row ${i} failed: ${e.message}`);
      skipped++;
    }
  }

  await prisma.revenueImportBatch.update({
    where: { id: batch.id },
    data: { rowsImported: imported, rowsSkipped: skipped },
  });
  return { imported, skipped };
}

async function main() {
  fs.mkdirSync(DONE_DIR, { recursive: true });
  fs.mkdirSync(FAIL_DIR, { recursive: true });
  const files = fs.existsSync(DROP_DIR)
    ? fs.readdirSync(DROP_DIR).filter((f) => f.toLowerCase().endsWith(".csv"))
    : [];
  if (!files.length) {
    console.log("no CSVs in drop folder — nothing to do");
    return;
  }
  for (const f of files) {
    try {
      const { imported, skipped } = await importFile(f);
      fs.renameSync(path.join(DROP_DIR, f), path.join(DONE_DIR, `${Date.now()}-${f}`));
      console.log(`✅ ${f}: ${imported} rows imported, ${skipped} skipped`);
    } catch (e) {
      fs.renameSync(path.join(DROP_DIR, f), path.join(FAIL_DIR, f));
      fs.writeFileSync(path.join(FAIL_DIR, `${f}.reason.txt`), String(e.message));
      console.error(`❌ ${f}: ${e.message} (moved to imported/failed/)`);
    }
  }
}

main()
  .catch((e) => { console.error("Fatal:", e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
