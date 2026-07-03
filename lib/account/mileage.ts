// MileIQ mileage-log parsing + IRS deduction helpers.
//
// Handles the real MileIQ CSV export (RFC-4180 quoted fields, with Excel
// FORMULA cells for MILES_VALUE/TOTAL like `=ROUND(PRODUCT(F12,G12),2)`) as
// well as a pasted detailed-log (tab- or space-collapsed). The tokenizer
// respects quotes; formula cells are recomputed from rate/miles/parking/tolls.

// 2026 IRS standard mileage rates (per the MileIQ export header).
export const IRS_RATES: Record<string, number> = {
  Business: 0.725,
  Medical: 0.205,
  Moving: 0.205,
  Charity: 0.14,
  Personal: 0,
  Commute: 0,
};

// Categories whose miles produce a tax deduction.
export const DEDUCTIBLE = new Set(['Business', 'Medical', 'Moving', 'Charity']);

export type ParsedTrip = {
  startDate: Date;
  endDate: Date;
  category: string;
  purpose: string | null;
  startAddr: string;
  stopAddr: string;
  rate: number;
  miles: number;
  milesValue: number;
  parking: number;
  tolls: number;
  total: number;
  vehicle: string;
  notes: string | null;
  year: number;
  dedupeKey: string;
};

// "01/01/2026 10:30" -> Date (local time)
function parseMileIqDate(s: string): Date | null {
  const m = s.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const [, mm, dd, yyyy, hh, min] = m;
  return new Date(Number(yyyy), Number(mm) - 1, Number(dd), Number(hh), Number(min));
}

const isFormula = (s: string | undefined) => !!s && s.trim().startsWith('=');

function num(s: string | undefined): number {
  if (!s || isFormula(s)) return 0;
  const n = parseFloat(s.replace(/[$,]/g, '').trim());
  return Number.isFinite(n) ? n : 0;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

// Tokenize one CSV/TSV line, honoring "quoted, fields". Picks delimiter:
// tab if present, else comma, else falls back to runs-of-2+-spaces (pasted).
function tokenize(line: string): string[] {
  const delim = line.includes('\t') ? '\t' : line.includes(',') ? ',' : '';
  if (!delim) return line.split(/\s{2,}/).map((c) => c.trim());

  const out: string[] = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQ = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQ = true;
    } else if (ch === delim) {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((c) => c.trim());
}

/**
 * Parse a MileIQ export (full CSV report, just the rows, or a pasted log).
 * Skips the rates/summary header automatically — only lines whose first cell
 * is a date+time are treated as trips. Returns valid trips + skipped count.
 */
export function parseMileIqLog(raw: string): { trips: ParsedTrip[]; skipped: number } {
  const lines = raw.split(/\r?\n/);
  const trips: ParsedTrip[] = [];
  const seen = new Set<string>();
  let skipped = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (!/^"?\d{1,2}\/\d{1,2}\/\d{4}\s+\d{1,2}:\d{2}/.test(trimmed)) continue;

    const cols = tokenize(trimmed);
    // START_DATE END_DATE CATEGORY START STOP RATE MILES MILES_VALUE PARKING TOLLS TOTAL VEHICLE PURPOSE [NOTES]
    if (cols.length < 11) {
      skipped++;
      continue;
    }

    const startDate = parseMileIqDate(cols[0]);
    if (!startDate) {
      skipped++;
      continue;
    }
    const endDate = parseMileIqDate(cols[1]) || startDate;

    const rawCategory = (cols[2] || 'Business').trim();
    const startAddr = cols[3] || '';
    const stopAddr = cols[4] || '';
    const rate = num(cols[5]);
    const miles = num(cols[6]);
    const parking = num(cols[8]);
    const tolls = num(cols[9]);
    // MILES_VALUE / TOTAL are formula cells in the MileIQ CSV — recompute.
    const milesValue = isFormula(cols[7]) ? round2(rate * miles) : num(cols[7]);
    const total = isFormula(cols[10]) ? round2(milesValue + parking + tolls) : num(cols[10]);
    const vehicle = (cols[11] || 'CarPlay').trim();
    const purpose = cols[12] ? cols[12].trim() : null;
    const notes = cols[13] ? cols[13].trim() : null;

    // Effective tax bucket: MileIQ keeps the deductible sub-type (Medical/
    // Moving/Charity/Commute) in PURPOSE while CATEGORY is just Business/Personal.
    let category = rawCategory;
    if (purpose && ['Medical', 'Moving', 'Charity', 'Commute'].includes(purpose)) {
      category = purpose;
    }

    const dedupeKey = `${startDate.toISOString()}|${stopAddr}|${miles}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    trips.push({
      startDate,
      endDate,
      category,
      purpose,
      startAddr,
      stopAddr,
      rate,
      miles,
      milesValue,
      parking,
      tolls,
      total,
      vehicle,
      notes,
      year: startDate.getFullYear(),
      dedupeKey,
    });
  }

  return { trips, skipped };
}

export type CategorySummary = {
  category: string;
  rate: number;
  miles: number;
  deduction: number;
  count: number;
  deductible: boolean;
};

export type MileageSummary = {
  categories: CategorySummary[];
  businessMiles: number;
  businessDeduction: number;
  deductibleMiles: number;
  totalDeduction: number;
  personalMiles: number;
  totalMiles: number;
  totalTrips: number;
  totalParking: number;
  totalTolls: number;
};

type TripLike = {
  category: string;
  miles: number;
  milesValue: number;
  rate: number;
  parking: number;
  tolls: number;
};

export function summarize(trips: TripLike[]): MileageSummary {
  const catMap: Record<string, CategorySummary> = {};
  let totalMiles = 0;
  let totalParking = 0;
  let totalTolls = 0;

  for (const t of trips) {
    const cat = t.category || 'Business';
    if (!catMap[cat]) {
      catMap[cat] = {
        category: cat,
        rate: IRS_RATES[cat] ?? t.rate ?? 0,
        miles: 0,
        deduction: 0,
        count: 0,
        deductible: DEDUCTIBLE.has(cat),
      };
    }
    catMap[cat].miles += t.miles;
    catMap[cat].deduction += t.milesValue || t.miles * (IRS_RATES[cat] ?? 0);
    catMap[cat].count++;
    totalMiles += t.miles;
    totalParking += t.parking || 0;
    totalTolls += t.tolls || 0;
  }

  const categories = Object.values(catMap)
    .map((c) => ({ ...c, miles: round2(c.miles), deduction: round2(c.deduction) }))
    .sort((a, b) => b.deduction - a.deduction || b.miles - a.miles);

  const biz = catMap['Business'];
  const deductibleMiles = categories.filter((c) => c.deductible).reduce((s, c) => s + c.miles, 0);
  const totalDeduction =
    categories.filter((c) => c.deductible).reduce((s, c) => s + c.deduction, 0) +
    totalParking +
    totalTolls;
  const personalMiles = categories.filter((c) => !c.deductible).reduce((s, c) => s + c.miles, 0);

  return {
    categories,
    businessMiles: round2(biz?.miles ?? 0),
    businessDeduction: round2(biz?.deduction ?? 0),
    deductibleMiles: round2(deductibleMiles),
    totalDeduction: round2(totalDeduction),
    personalMiles: round2(personalMiles),
    totalMiles: round2(totalMiles),
    totalTrips: trips.length,
    totalParking: round2(totalParking),
    totalTolls: round2(totalTolls),
  };
}

// Build an IRS-compliant CSV (computed values, no formulas) from stored trips.
export function tripsToCsv(
  trips: Array<{
    startDate: Date | string;
    endDate: Date | string;
    category: string;
    startAddr: string;
    stopAddr: string;
    rate: number;
    miles: number;
    milesValue: number;
    parking: number;
    tolls: number;
    total: number;
    vehicle: string;
    purpose: string | null;
    notes: string | null;
  }>
): string {
  const head = [
    'START_DATE', 'END_DATE', 'CATEGORY', 'START', 'STOP', 'RATE',
    'MILES', 'MILES_VALUE', 'PARKING', 'TOLLS', 'TOTAL', 'VEHICLE', 'PURPOSE', 'NOTES',
  ];
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const fmtDate = (d: Date | string) =>
    new Date(d).toLocaleString('en-US', {
      month: '2-digit', day: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: false,
    });
  const rows = trips.map((t) =>
    [
      fmtDate(t.startDate), fmtDate(t.endDate), t.category, t.startAddr, t.stopAddr,
      t.rate, t.miles, t.milesValue, t.parking, t.tolls, t.total,
      t.vehicle, t.purpose || '', t.notes || '',
    ]
      .map(esc)
      .join(',')
  );
  return [head.join(','), ...rows].join('\r\n');
}
