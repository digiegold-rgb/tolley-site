import type { HeatDay, HeatRows, HeatSnapshot, HeatTotals, HeatView } from "./types";
import {
  CCF_BASELINE,
  HEAT_GAP_MS,
  ZONE,
  chicagoDate,
  monthStart,
  startOfChicagoDay,
  weekStartMonday,
} from "./time";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function cents(n: number | null): number | null {
  return n == null ? null : Math.round(n * 100) / 100;
}

function byTime(a: HeatSnapshot, b: HeatSnapshot): number {
  return Date.parse(a.recordedAt) - Date.parse(b.recordedAt);
}

export function heatHoursInWindow(
  snapshots: HeatSnapshot[],
  fromMs: number,
  toMs: number,
): { upstairs: number; downstairs: number } {
  const sorted = [...snapshots].filter((s) => Date.parse(s.recordedAt) < toMs).sort(byTime);
  let upstairs = 0;
  let downstairs = 0;
  for (let i = 0; i < sorted.length; i++) {
    const startAt = Date.parse(sorted[i].recordedAt);
    const nextAt = i + 1 < sorted.length ? Date.parse(sorted[i + 1].recordedAt) : toMs;
    const start = Math.max(startAt, fromMs);
    const end = Math.min(nextAt, toMs, startAt + HEAT_GAP_MS);
    if (end <= start) continue;
    const hours = (end - start) / 3_600_000;
    if (sorted[i].upstairs.hvac === "heat") upstairs += hours;
    if (sorted[i].downstairs.hvac === "heat") downstairs += hours;
  }
  return { upstairs: round2(upstairs), downstairs: round2(downstairs) };
}

function deduped(rows: HeatRows): HeatSnapshot[] {
  const map = new Map<string, HeatSnapshot>();
  for (const row of rows.snapshots) map.set(row.recordedAt, row);
  if (rows.latest) map.set(rows.latest.recordedAt, rows.latest);
  return [...map.values()].sort(byTime);
}

function pickLatest(rows: HeatSnapshot[]): HeatSnapshot | null {
  return rows.length ? rows[rows.length - 1] : null;
}

function mid(a: number | null, b: number | null): number | null {
  if (a == null && b == null) return null;
  if (a == null) return b;
  if (b == null) return a;
  return (a + b) / 2;
}

function costPerHour(days: HeatDay[], today: string): { low: number | null; high: number | null } {
  const recent = days.filter((d) => d.date < today && d.upstairsHeatH + d.downstairsHeatH > 0).slice(-30);
  const lowDays = recent.filter((d) => d.estCostLow != null);
  const highDays = recent.filter((d) => d.estCostHigh != null);
  const lowHours = lowDays.reduce((sum, d) => sum + d.upstairsHeatH + d.downstairsHeatH, 0);
  const highHours = highDays.reduce((sum, d) => sum + d.upstairsHeatH + d.downstairsHeatH, 0);
  return {
    low: lowHours > 0 ? lowDays.reduce((sum, d) => sum + (d.estCostLow ?? 0), 0) / lowHours : null,
    high: highHours > 0 ? highDays.reduce((sum, d) => sum + (d.estCostHigh ?? 0), 0) / highHours : null,
  };
}

function sumPeriod(
  days: HeatDay[],
  from: string,
  to: string,
  label: string,
  extra: { upstairsHeatH: number; downstairsHeatH: number; costLow: number | null; costHigh: number | null } | null,
): HeatTotals {
  const inRange = days.filter((d) => d.date >= from && d.date <= to);
  let upstairs = inRange.reduce((sum, d) => sum + d.upstairsHeatH, 0);
  let downstairs = inRange.reduce((sum, d) => sum + d.downstairsHeatH, 0);
  let costLow = 0;
  let costHigh = 0;
  let hdd = 0;
  let seenLow = false;
  let seenHigh = false;
  let seenHdd = false;
  for (const day of inRange) {
    if (day.estCostLow != null) {
      costLow += day.estCostLow;
      seenLow = true;
    }
    if (day.estCostHigh != null) {
      costHigh += day.estCostHigh;
      seenHigh = true;
    }
    if (day.hdd65 != null) {
      hdd += day.hdd65;
      seenHdd = true;
    }
  }
  if (extra) {
    upstairs += extra.upstairsHeatH;
    downstairs += extra.downstairsHeatH;
    if (extra.costLow != null) {
      costLow += extra.costLow;
      seenLow = true;
    }
    if (extra.costHigh != null) {
      costHigh += extra.costHigh;
      seenHigh = true;
    }
  }
  return {
    label,
    from,
    to,
    upstairsHeatH: round2(upstairs),
    downstairsHeatH: round2(downstairs),
    costLow: seenLow ? cents(costLow) : null,
    costHigh: seenHigh ? cents(costHigh) : null,
    hdd65: seenHdd ? round2(hdd) : null,
  };
}

export function emptyHeatView(now = new Date()): HeatView {
  const today = chicagoDate(now);
  return {
    generatedAt: now.toISOString(),
    sample: false,
    zone: ZONE,
    latest: null,
    today: {
      date: today,
      costLow: null,
      costHigh: null,
      source: "none",
      upstairsHeatH: 0,
      downstairsHeatH: 0,
    },
    series24h: [],
    days: [],
    week: {
      label: "This week",
      from: weekStartMonday(today),
      to: today,
      upstairsHeatH: 0,
      downstairsHeatH: 0,
      costLow: null,
      costHigh: null,
      hdd65: null,
    },
    month: {
      label: "This month",
      from: monthStart(today),
      to: today,
      upstairsHeatH: 0,
      downstairsHeatH: 0,
      costLow: null,
      costHigh: null,
      hdd65: null,
    },
    ccf: { baseline: CCF_BASELINE, recentAvg: null, days: 0, versusBaseline: null },
    review: null,
  };
}

export function buildHeatView(rows: HeatRows, now = new Date()): HeatView {
  const today = chicagoDate(now);
  const snapshots = deduped(rows);
  const latest = pickLatest(snapshots);
  const from24 = now.getTime() - 24 * 60 * 60 * 1000;
  const series24h = snapshots
    .filter((s) => {
      const t = Date.parse(s.recordedAt);
      return t >= from24 && t <= now.getTime() + 15 * 60 * 1000;
    })
    .map((s) => ({
      t: s.recordedAt,
      kitchenF: s.kitchenF,
      loftF: s.loftF,
      outdoorF: s.outdoorF,
      upstairsHeat: s.upstairs.hvac === "heat",
      downstairsHeat: s.downstairs.hvac === "heat",
    }));

  const dayStart = startOfChicagoDay(now).getTime();
  const snapHours = heatHoursInWindow(snapshots, dayStart, now.getTime());
  const snapTotal = snapHours.upstairs + snapHours.downstairs;
  const days = [...rows.days].sort((a, b) => a.date.localeCompare(b.date));
  const reported = days.find((d) => d.date === today) ?? null;
  const reportedHours = reported ? reported.upstairsHeatH + reported.downstairsHeatH : 0;
  const reportedCost = Boolean(reported && (reported.estCostLow != null || reported.estCostHigh != null));
  const useReported = Boolean(reported && (reportedCost || reportedHours > 0) && !(reportedHours === 0 && snapTotal >= 0.05));

  let todayBlock: HeatView["today"];
  if (useReported && reported) {
    todayBlock = {
      date: today,
      costLow: cents(reported.estCostLow),
      costHigh: cents(reported.estCostHigh),
      source: "reported",
      upstairsHeatH: round2(reported.upstairsHeatH),
      downstairsHeatH: round2(reported.downstairsHeatH),
    };
  } else if (snapTotal > 0) {
    const rate = costPerHour(days, today);
    const low = rate.low == null ? null : cents(snapTotal * rate.low);
    const high = rate.high == null ? null : cents(snapTotal * rate.high);
    todayBlock = {
      date: today,
      costLow: low ?? high,
      costHigh: high ?? low,
      source: low == null && high == null ? "none" : "estimated",
      upstairsHeatH: snapHours.upstairs,
      downstairsHeatH: snapHours.downstairs,
    };
  } else {
    todayBlock = {
      date: today,
      costLow: null,
      costHigh: null,
      source: "none",
      upstairsHeatH: 0,
      downstairsHeatH: 0,
    };
  }

  const daysForTotals = useReported ? days : days.filter((d) => d.date !== today);
  const extra =
    todayBlock.source === "reported"
      ? null
      : {
          upstairsHeatH: todayBlock.upstairsHeatH,
          downstairsHeatH: todayBlock.downstairsHeatH,
          costLow: todayBlock.source === "estimated" ? todayBlock.costLow : null,
          costHigh: todayBlock.source === "estimated" ? todayBlock.costHigh : null,
        };

  const withCcf = days.filter((d) => d.ccfPerHdd != null && (d.hdd65 == null || d.hdd65 > 0));
  const recent = withCcf.slice(-30);
  const recentAvg = recent.length
    ? Math.round((recent.reduce((sum, d) => sum + (d.ccfPerHdd ?? 0), 0) / recent.length) * 10000) / 10000
    : null;

  return {
    generatedAt: now.toISOString(),
    sample: false,
    zone: ZONE,
    latest: latest
      ? {
          recordedAt: latest.recordedAt,
          ageSec: Math.max(0, Math.round((now.getTime() - Date.parse(latest.recordedAt)) / 1000)),
          kitchenF: latest.kitchenF,
          loftF: latest.loftF,
          kitchenRh: latest.kitchenRh,
          loftRh: latest.loftRh,
          outdoorF: latest.outdoorF,
          upstairs: latest.upstairs,
          downstairs: latest.downstairs,
        }
      : null,
    today: todayBlock,
    series24h,
    days: days.map((d) => ({
      date: d.date,
      upstairsHeatH: d.upstairsHeatH,
      downstairsHeatH: d.downstairsHeatH,
      costLow: d.estCostLow,
      costHigh: d.estCostHigh,
      costMid: mid(d.estCostLow, d.estCostHigh),
      hdd65: d.hdd65,
      ccfPerHdd: d.ccfPerHdd,
      outdoorAvg: d.outdoorAvg,
    })),
    week: sumPeriod(daysForTotals, weekStartMonday(today), today, "This week", extra),
    month: sumPeriod(daysForTotals, monthStart(today), today, "This month", extra),
    ccf: {
      baseline: CCF_BASELINE,
      recentAvg,
      days: recent.length,
      versusBaseline: recentAvg == null ? null : (recentAvg - CCF_BASELINE) / CCF_BASELINE,
    },
    review: rows.review,
  };
}
