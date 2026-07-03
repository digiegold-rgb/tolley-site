import * as XLSX from "xlsx";
import { createHash } from "crypto";

export interface ParsedEntry {
  business: string;
  channel: string | null;
  itemDesc: string | null;
  date: Date | null;
  gross: number | null;
  cost: number | null;
  fees: number | null;
  profit: number | null;
  inventoryRem: number | null;
  notes: string | null;
  sourceFile: string;
  sourceSheet: string;
  sourceRowIdx: number;
  dedupKey: string;
}

export interface BusinessTotals {
  business: string;
  gross?: number;
  cost?: number;
  profit?: number;
  profitOptimistic?: number;
  inventoryRem?: number;
  sourceSheet: string;
}

export interface ParseResult {
  entries: ParsedEntry[];
  skippedSheets: { name: string; reason: string }[];
  sheetCount: number;
  byBusiness: Record<string, number>;
  byChannel: Record<string, number>;
  businessTotals: BusinessTotals[];
}

// Numbers→Excel exports use a few sheet types we never want to import:
// metadata, totals/rollups, and explicitly-empty owner-draw tables.
// Numbers exports truncate long tab names — "Totals" sometimes lands as
// "Tota". Match both.
const SKIP_SHEET_PATTERNS = [
  /^Export Summary$/i,
  /\bTotals$/i,
  /\bTotal?s?-Tota$/i,
  /-\s*Tota$/i,
  /\bCash Flow$/i,
  /\bDrawings$/i,
  /\bOverall Profit$/i,
  /\bTable 1$/i, // Numbers' default table name on per-week summary sheets
  /\bPer Week/i,
];

// Map a sheet name to (business, channel). Sheet names from Numbers come
// through as "<Numbers Sheet> - <Numbers Table>". We split on " - " and
// treat the prefix as the business and the suffix as the channel/sub-context.
function splitBusinessAndChannel(sheetName: string): { business: string; channel: string | null } {
  const trimmed = sheetName.trim();
  const sep = trimmed.indexOf(" - ");
  if (sep === -1) return { business: trimmed, channel: null };
  return {
    business: trimmed.slice(0, sep).trim(),
    channel: trimmed.slice(sep + 3).trim() || null,
  };
}

// Excel stores dates as serial numbers (days since 1900-01-01, with quirks).
// xlsx exposes utils.ssf to format, but for our purposes we just need to
// detect "is this a date" and convert.
function excelSerialToDate(n: number): Date | null {
  if (!Number.isFinite(n)) return null;
  // Plausible date range: 1990 → 2050 in Excel serial terms (32874 → 54789).
  if (n < 30000 || n > 60000) return null;
  const utcMs = (n - 25569) * 86400 * 1000;
  const d = new Date(utcMs);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function toNumber(val: unknown): number | null {
  if (val === null || val === undefined || val === "") return null;
  if (typeof val === "number") return Number.isFinite(val) ? val : null;
  if (typeof val !== "string") return null;
  // Strip $, commas, spaces, parentheses (negative).
  const cleaned = val.replace(/[$,\s]/g, "").replace(/^\((.*)\)$/, "-$1");
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}

function toString(val: unknown): string | null {
  if (val === null || val === undefined) return null;
  const s = String(val).trim();
  return s.length > 0 ? s : null;
}

// Pick the column for a target field by fuzzy-matching header names.
// Returns the FIRST column whose normalized header matches any pattern.
function pickColumn(headers: string[], patterns: RegExp[]): string | null {
  for (const h of headers) {
    const norm = h.trim().toLowerCase().replace(/\s+/g, " ");
    if (patterns.some((p) => p.test(norm))) return h;
  }
  return null;
}

// Some sheets have an unlabeled first column (Numbers→Excel exports it as
// "__EMPTY"). Treat that as the item description by default.
// Item-description columns. Note: "Contact" looks tempting on Sales Extra
// Flip but actually holds dates there; never use it as the item name.
const ITEM_PATTERNS = [
  /^name of card/,
  /^item$/,
  /^item\s/,
];

const GROSS_PATTERNS = [
  /^sold for$/,
  /^sold\s*$/,
  /^rented totals$/,
  /^total amount sold$/,
  /^total sales of items$/,
  /^offers$/,
];

const COST_PATTERNS = [
  /^total costs?$/,
  /^cost\s*$/,
  /^cost \+ repairs totals$/,
  /^paid in store$/,
  /^total amount spent$/,
];

const PROFIT_PATTERNS = [
  /^profits?$/,
  /^rental profit$/,
  /^total sold profits$/,
  /^net profit$/,
];

const FEES_PATTERNS = [/tax/, /^fees?$/, /shipping$/];

// "Repairs" is a real cost component on the Extra Extra! Sales sheet.
// We surface it as `fees` for transparency AND fold it into `cost` so the
// rolled-up totals match the user's Numbers Totals tabs.
const REPAIRS_PATTERNS = [/^repairs?$/];

const INVENTORY_PATTERNS = [
  /inventory remaining/,
  /^total innovatory left$/, // typo "innovatory" appears in source sheet
  /^total innovatory$/,
];

const DATE_PATTERNS = [/^date$/, /^cargo largo$/, /^contact$/, /^per week profit$/];

function detectDateColumn(rows: Record<string, unknown>[], headers: string[]): string | null {
  // First, prefer a header that looks like a date column.
  const named = pickColumn(headers, DATE_PATTERNS);
  if (named) {
    // Verify the column actually holds date-like values
    const sample = rows.slice(0, 5).map((r) => r[named]);
    const looksLikeDate = sample.some((v) => {
      if (typeof v === "number") return excelSerialToDate(v) !== null;
      if (typeof v === "string") {
        return /^\d{1,4}[/-]\d{1,2}([/-]\d{1,4})?$/.test(v.trim());
      }
      return false;
    });
    if (looksLikeDate) return named;
  }
  return null;
}

function parseDateValue(val: unknown): Date | null {
  if (typeof val === "number") return excelSerialToDate(val);
  if (typeof val === "string") {
    const s = val.trim();
    // Try MM/DD/YYYY or M/D
    const fullMatch = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
    if (fullMatch) {
      const [, m, d, y] = fullMatch;
      const year = y.length === 2 ? 2000 + parseInt(y, 10) : parseInt(y, 10);
      const dt = new Date(year, parseInt(m, 10) - 1, parseInt(d, 10));
      return Number.isNaN(dt.getTime()) ? null : dt;
    }
    const shortMatch = s.match(/^(\d{1,2})[/-](\d{1,2})$/);
    if (shortMatch) {
      const [, m, d] = shortMatch;
      const dt = new Date(new Date().getFullYear(), parseInt(m, 10) - 1, parseInt(d, 10));
      return Number.isNaN(dt.getTime()) ? null : dt;
    }
    return null;
  }
  return null;
}

function makeDedupKey(parts: {
  sourceFile: string;
  sheet: string;
  rowIdx: number;
  itemDesc: string | null;
  gross: number | null;
  cost: number | null;
}): string {
  const blob = [
    parts.sourceFile,
    parts.sheet,
    parts.rowIdx,
    parts.itemDesc ?? "",
    parts.gross ?? "",
    parts.cost ?? "",
  ].join("|");
  return createHash("sha1").update(blob).digest("hex");
}

// Pull authoritative totals from a Numbers "Totals"-style sheet. Returns
// undefined if the sheet doesn't look like a totals sheet.
function extractBusinessTotals(
  sheetName: string,
  ws: XLSX.WorkSheet
): BusinessTotals | undefined {
  const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null }) as unknown[][];
  if (aoa.length < 2) return undefined;

  // We expect a [headers, values] shape. Headers in row 0, values in row 1.
  const headers = (aoa[0] || []).map((h) => (h == null ? "" : String(h).trim().toLowerCase()));
  const valuesRow = aoa[1] || [];
  if (headers.every((h) => !h)) return undefined;

  const findIdx = (patterns: RegExp[]): number =>
    headers.findIndex((h) => patterns.some((p) => p.test(h)));

  const grossIdx = findIdx([
    /total amount sold/,
    /total sales of items/,
    /total amount rented/,
    /total rented/,
  ]);
  const costIdx = findIdx([
    /total amount spent/,
    /cost \+ repairs totals/,
  ]);
  const profitIdx = findIdx([
    /total sold profits/,
    /^profit$/,
    /rental profit/,
    /total profit of cards sold/,
  ]);
  const optimisticIdx = findIdx([/profit if sold all/]);
  const inventoryIdx = findIdx([
    /total innovatory left/,
    /total innovatory$/,
    /total inventory$/,
  ]);

  const numAt = (i: number): number | undefined => {
    if (i < 0) return undefined;
    const v = valuesRow[i];
    if (v == null) return undefined;
    if (typeof v === "number") return v;
    if (typeof v === "string") {
      const n = parseFloat(v.replace(/[$,\s]/g, ""));
      return Number.isFinite(n) ? n : undefined;
    }
    return undefined;
  };

  const sep = sheetName.indexOf(" - ");
  const business = sep === -1 ? sheetName.trim() : sheetName.slice(0, sep).trim();

  const gross = numAt(grossIdx);
  const cost = numAt(costIdx);
  const profit = numAt(profitIdx);
  const profitOptimistic = numAt(optimisticIdx);
  const inventoryRem = numAt(inventoryIdx);

  // Fallback: "label-value pairs" layout (col 0 = label, col 1 = value).
  // Used by Cards for Fip - Overall Profit.
  if (
    gross === undefined &&
    cost === undefined &&
    profit === undefined &&
    inventoryRem === undefined
  ) {
    let lvProfit: number | undefined;
    let lvValue: number | undefined;
    for (const row of aoa) {
      const label = String(row?.[0] ?? "").toLowerCase();
      const value = row?.[1];
      const n = typeof value === "number" ? value : null;
      if (n === null) continue;
      if (/total profit of cards sold|total sold profits|^profit$/i.test(label)) {
        lvProfit = n;
      } else if (/total value of our cards|total inventory|inventory value/i.test(label)) {
        lvValue = n;
      }
    }
    if (lvProfit !== undefined || lvValue !== undefined) {
      return {
        business,
        profit: lvProfit,
        inventoryRem: lvValue,
        sourceSheet: sheetName,
      };
    }
    return undefined;
  }

  return { business, gross, cost, profit, profitOptimistic, inventoryRem, sourceSheet: sheetName };
}

export function parseRevenueWorkbook(buffer: Buffer, sourceFile: string): ParseResult {
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: false, raw: true });

  const entries: ParsedEntry[] = [];
  const skipped: { name: string; reason: string }[] = [];
  const byBusiness: Record<string, number> = {};
  const byChannel: Record<string, number> = {};
  const businessTotals: BusinessTotals[] = [];

  for (const sheetName of wb.SheetNames) {
    if (SKIP_SHEET_PATTERNS.some((p) => p.test(sheetName))) {
      // Even though we skip these as line items, they may contain official
      // totals worth capturing.
      const totals = extractBusinessTotals(sheetName, wb.Sheets[sheetName]);
      if (totals) businessTotals.push(totals);
      skipped.push({ name: sheetName, reason: "metadata or rollup" });
      continue;
    }

    const ws = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
      defval: null,
      raw: true,
    });

    if (rows.length === 0) {
      skipped.push({ name: sheetName, reason: "empty" });
      continue;
    }

    const headers = Object.keys(rows[0]);
    const itemCol =
      pickColumn(headers, ITEM_PATTERNS) ||
      headers.find((h) => /^__EMPTY$/.test(h)) ||
      headers[0];
    const grossCol = pickColumn(headers, GROSS_PATTERNS);
    const costCol = pickColumn(headers, COST_PATTERNS);
    const profitCol = pickColumn(headers, PROFIT_PATTERNS);
    const feesCol = pickColumn(headers, FEES_PATTERNS);
    const repairsCol = pickColumn(headers, REPAIRS_PATTERNS);
    const inventoryCol = pickColumn(headers, INVENTORY_PATTERNS);
    const dateCol = detectDateColumn(rows, headers);

    // If no useful columns at all, skip.
    if (!grossCol && !costCol && !profitCol) {
      skipped.push({
        name: sheetName,
        reason: `no recognizable money columns in [${headers.join(", ")}]`,
      });
      continue;
    }

    const { business, channel } = splitBusinessAndChannel(sheetName);

    let imported = 0;
    rows.forEach((row, idx) => {
      const itemDesc = itemCol ? toString(row[itemCol]) : null;
      const gross = grossCol ? toNumber(row[grossCol]) : null;
      const baseCost = costCol ? toNumber(row[costCol]) : null;
      const repairs = repairsCol ? toNumber(row[repairsCol]) : null;
      const taxFees = feesCol ? toNumber(row[feesCol]) : null;

      // Repairs is always a cost component; fold in. Tax is left in `fees`
      // and NOT subtracted from cost — peeling auto from line items proved
      // brittle (different sheets handle tax differently). The dashboard
      // uses the source's own Totals tab as authoritative for headline cost.
      const cost =
        baseCost === null && repairs === null
          ? null
          : (baseCost ?? 0) + (repairs ?? 0);

      // Profit: prefer the source's pre-computed Profit column; otherwise
      // derive as gross + cost (cost may be signed negative for Table Rentals,
      // hence + not -). Falls back to null if we have neither side.
      let profit = profitCol ? toNumber(row[profitCol]) : null;
      if (profit === null && (gross !== null || cost !== null)) {
        const grossPart = gross ?? 0;
        const costPart = cost ?? 0;
        // If cost looks negative (signed outflow), it adds; otherwise subtract.
        profit = costPart < 0 ? grossPart + costPart : grossPart - costPart;
      }
      // `fees` always shows tax (dedicated col) when present; otherwise repairs.
      const fees = taxFees ?? repairs ?? null;
      const inventoryRem = inventoryCol ? toNumber(row[inventoryCol]) : null;
      const date = dateCol ? parseDateValue(row[dateCol]) : null;

      // Skip obviously-empty rows (no item, no money).
      if (!itemDesc && gross === null && cost === null && profit === null) return;

      // Skip "Totals" rows that show up in line-item sheets — either flagged
      // by an explicit "Total..." label, OR a row with no item description
      // but money values (Numbers exports the bottom totals row this way).
      if (itemDesc && /^total/i.test(itemDesc)) return;
      if (!itemDesc && (gross !== null || cost !== null || profit !== null)) return;

      const dedupKey = makeDedupKey({
        sourceFile,
        sheet: sheetName,
        rowIdx: idx,
        itemDesc,
        gross,
        cost,
      });

      entries.push({
        business,
        channel,
        itemDesc,
        date,
        gross,
        cost,
        fees,
        profit,
        inventoryRem,
        notes: null,
        sourceFile,
        sourceSheet: sheetName,
        sourceRowIdx: idx,
        dedupKey,
      });
      imported++;
    });

    byBusiness[business] = (byBusiness[business] || 0) + imported;
    if (channel) {
      const key = `${business} :: ${channel}`;
      byChannel[key] = (byChannel[key] || 0) + imported;
    }

    if (imported === 0) {
      skipped.push({ name: sheetName, reason: "rows present but no usable data" });
    }
  }

  return {
    entries,
    skippedSheets: skipped,
    sheetCount: wb.SheetNames.length,
    byBusiness,
    byChannel,
    businessTotals,
  };
}
