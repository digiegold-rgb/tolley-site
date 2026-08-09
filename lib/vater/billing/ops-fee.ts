/**
 * lib/vater/billing/ops-fee.ts — the "Render Operations" invoice line.
 *
 * Billing has two components and they are deliberately separate:
 *   1. "Compute (at cost)"  — the per-model GPU/API spend, passed through
 *      UNCHANGED. That calculation is not touched by this module.
 *   2. "Render Operations"  — finished_video_minutes x OPS_RATE. This is the
 *      operations margin, and it scales with delivered output rather than
 *      with how expensive a given model happened to be.
 *
 * OPS_RATE lives in ~/vater-studio/VATER-SETTINGS.env as
 * VATER_OPS_RATE_PER_MIN (dollars per finished minute) so the rate can change
 * without touching billing logic. Falls back to 1.00/min when unset.
 */
import "server-only";
import { readFileSync } from "node:fs";

const SETTINGS_PATH = "/home/jelly/vater-studio/VATER-SETTINGS.env";
const DEFAULT_OPS_RATE = 1.0;

let cached: { rate: number; at: number } | null = null;

/** Dollars charged per finished video minute. Re-read at most once a minute
 *  so a config edit takes effect without a deploy. */
export function getOpsRate(): number {
  if (cached && Date.now() - cached.at < 60_000) return cached.rate;
  let rate = DEFAULT_OPS_RATE;
  try {
    const line = readFileSync(SETTINGS_PATH, "utf8")
      .split("\n")
      .find((l) => l.trim().startsWith("VATER_OPS_RATE_PER_MIN="));
    if (line) {
      const parsed = Number(line.split("=")[1]?.trim().replace(/["']/g, ""));
      // A zero rate is a legitimate setting (ops fee switched off); only a
      // non-numeric or negative value falls back to the default.
      if (Number.isFinite(parsed) && parsed >= 0) rate = parsed;
    }
  } catch {
    /* config unreadable — default rate */
  }
  cached = { rate, at: Date.now() };
  return rate;
}

export interface VideoBillingLine {
  projectId: string;
  title: string;
  /** Finished runtime in seconds. */
  durationSeconds: number;
  /** Finished runtime in minutes, the ops-fee billing unit. */
  minutes: number;
  /** Pass-through compute spend, at cost. */
  computeUsd: number;
  /** minutes x OPS_RATE. */
  opsUsd: number;
  /** computeUsd + opsUsd. */
  totalUsd: number;
  /** totalUsd / minutes — what a minute of finished video actually costs. */
  effectiveUsdPerMinute: number;
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

/** Build one invoice line for a finished video. Compute cost is passed in
 *  unchanged — this never recalculates it. */
export function buildVideoBillingLine(input: {
  projectId: string;
  title: string;
  durationSeconds: number;
  computeUsd: number;
  opsRate?: number;
}): VideoBillingLine {
  const rate = input.opsRate ?? getOpsRate();
  const minutes = Math.max(0, input.durationSeconds) / 60;
  const computeUsd = round2(input.computeUsd);
  const opsUsd = round2(minutes * rate);
  const totalUsd = round2(computeUsd + opsUsd);
  return {
    projectId: input.projectId,
    title: input.title,
    durationSeconds: input.durationSeconds,
    minutes: Math.round(minutes * 100) / 100,
    computeUsd,
    opsUsd,
    totalUsd,
    effectiveUsdPerMinute: minutes > 0 ? round2(totalUsd / minutes) : 0,
  };
}

export interface InvoiceTotals {
  lines: VideoBillingLine[];
  computeSubtotalUsd: number;
  opsSubtotalUsd: number;
  totalUsd: number;
  totalMinutes: number;
  opsRate: number;
}

/** Roll per-video lines into the two invoice line items + total. */
export function buildInvoiceTotals(
  lines: VideoBillingLine[],
  opsRate = getOpsRate(),
): InvoiceTotals {
  const computeSubtotalUsd = round2(lines.reduce((a, l) => a + l.computeUsd, 0));
  const opsSubtotalUsd = round2(lines.reduce((a, l) => a + l.opsUsd, 0));
  return {
    lines,
    computeSubtotalUsd,
    opsSubtotalUsd,
    totalUsd: round2(computeSubtotalUsd + opsSubtotalUsd),
    totalMinutes: Math.round(lines.reduce((a, l) => a + l.minutes, 0) * 100) / 100,
    opsRate,
  };
}

export const INVOICE_LABELS = {
  compute: "Compute (at cost)",
  ops: "Render Operations",
} as const;
