/**
 * lib/vater/billing/script-due.ts — Script writer / Talk charges on Current due.
 *
 * Source of truth: VaterUsage rows with action="script". These land the
 * moment generate or Talk succeeds — they must move dueUsd immediately,
 * without waiting for a delivered video. Pipeline LLM on a video card
 * stays "LLM"; writer/chat is "Script". Never double-count into costJson.
 */

export interface ScriptBreakdownRow {
  key: string;
  label: string;
  usd: number;
}

export const SCRIPT_USAGE_ACTION = "script";
export const SCRIPT_BREAKDOWN_KEY = "script";
export const SCRIPT_BREAKDOWN_LABEL = "Script";

const r2 = (n: number) => Math.round(n * 100) / 100;

export function centsToUsd(cents: number): number {
  if (!Number.isFinite(cents) || cents <= 0) return 0;
  return r2(cents / 100);
}

export interface ScriptUsageRow {
  costCents: number;
  ts: Date | string;
}

function asDate(ts: Date | string): Date {
  return ts instanceof Date ? ts : new Date(ts);
}

/** All-time script cents for a tenant. */
export function sumScriptCents(rows: readonly ScriptUsageRow[]): number {
  return rows.reduce((n, row) => n + Math.max(0, Math.round(row.costCents) || 0), 0);
}

/** Script cents strictly after `since` (activity attribution). */
export function sumScriptCentsSince(
  rows: readonly ScriptUsageRow[],
  since: Date,
): number {
  return rows
    .filter((row) => asDate(row.ts) > since)
    .reduce((n, row) => n + Math.max(0, Math.round(row.costCents) || 0), 0);
}

export interface ScriptDueSlice {
  /** All-time script charges. */
  allUsd: number;
  /** Unpaid / new-since-last-payment script charges. */
  sinceUsd: number;
  basis: "snapshot" | "activity" | "all-time";
}

/**
 * What the Current due Script row should show.
 *
 *  - Never paid → all script usage is due.
 *  - Snapshot has scriptUsd → exact current − baseline (settlement).
 *  - Older payment (no scriptUsd) → activity: rows after the payment date.
 *    Tonight's generate after a pre-script Zelle shows up this way.
 */
export function scriptDueSlice(opts: {
  rows: readonly ScriptUsageRow[];
  lastPayment: { createdAt: Date; snapshotJson: unknown } | null;
}): ScriptDueSlice {
  const allCents = sumScriptCents(opts.rows);
  const allUsd = centsToUsd(allCents);
  if (!opts.lastPayment) {
    return { allUsd, sinceUsd: allUsd, basis: "all-time" };
  }
  const snap = opts.lastPayment.snapshotJson as { scriptUsd?: unknown } | null;
  if (snap && typeof snap.scriptUsd === "number" && Number.isFinite(snap.scriptUsd)) {
    return {
      allUsd,
      sinceUsd: r2(Math.max(0, allUsd - snap.scriptUsd)),
      basis: "snapshot",
    };
  }
  return {
    allUsd,
    sinceUsd: centsToUsd(sumScriptCentsSince(opts.rows, opts.lastPayment.createdAt)),
    basis: "activity",
  };
}

export function dueUsdWithScript(dueWithoutScript: number, scriptSinceUsd: number): number {
  return r2(Math.max(0, dueWithoutScript) + Math.max(0, scriptSinceUsd));
}

export function scriptBreakdownRow(usd: number): ScriptBreakdownRow | null {
  const n = r2(usd);
  if (n <= 0.005) return null;
  return { key: SCRIPT_BREAKDOWN_KEY, label: SCRIPT_BREAKDOWN_LABEL, usd: n };
}
