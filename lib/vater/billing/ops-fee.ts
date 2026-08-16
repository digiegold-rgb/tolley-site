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
 * OPS_RATE = env `VATER_OPS_RATE_PER_MIN` (dollars per finished minute),
 * default 0.35.
 *
 * ⚠️ 2026-08-15: this used to read /home/jelly/vater-studio/VATER-SETTINGS.env
 * off the DGX filesystem. That path does not exist on Vercel, so every
 * production read silently fell through to the default — a "no deploy needed"
 * knob that was in fact un-turnable. The env var is the real knob now (a
 * Vercel env change + redeploy), and the default still MATCHES the live rate
 * so a missing value can never invent a price.
 */
import "server-only";

// 35 cents per rendered minute — the actual rate (Jared 2026-08-08).
// Must MATCH the live rate: a default that differs lets a missing env invent
// a price, and a client rendering before the fetched rate lands would flash
// the wrong number.
const DEFAULT_OPS_RATE = 0.35;

/** Dollars charged per finished video minute. */
export function getOpsRate(): number {
  const raw = process.env.VATER_OPS_RATE_PER_MIN;
  if (raw === undefined || raw.trim() === "") return DEFAULT_OPS_RATE;
  const parsed = Number(raw.trim().replace(/["']/g, ""));
  // A zero rate is a legitimate setting (ops fee switched off); only a
  // non-numeric or negative value falls back to the default.
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : DEFAULT_OPS_RATE;
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
