/**
 * Market data quality scoring, source weights, and freshness calculations.
 */

export const SOURCE_WEIGHTS: Record<string, number> = {
  fred_indicator: 1.0,
  economic_indicator: 1.0,
  stock_reading: 0.95,
  video_analysis: 0.6,
  article_summary: 0.5,
  manual_note: 0.3,
};

// Expected update frequency in days for each FRED indicator
export const INDICATOR_FREQUENCY: Record<string, number> = {
  fedfunds: 1,
  unrate: 30,
  payems: 30,
  icsa: 7,
  cpiaucsl: 30,
  umcsent: 30,
  cscicp03usm665s: 30,
  gdpc1: 90,
  m2sl: 30,
  mspus: 90,
  csushpisa: 30,
  houst: 30,
  permit: 30,
  msacsr: 30,
  rrvrusq156n: 90,
  rhorusq156n: 90,
  t10y2y: 1,
  dexuseu: 1,
  mortgage30us: 7,
  mortgage15us: 7,
  dgs10: 1,
  dgs30: 1,
};

/**
 * Calculate freshness: 1.0 = just updated, 0.0 = significantly overdue
 */
export function getFreshness(lastUpdated: Date, frequencyDays: number): number {
  const ageMs = Date.now() - lastUpdated.getTime();
  const ageDays = ageMs / (86400 * 1000);
  const ratio = ageDays / frequencyDays;
  if (ratio <= 1) return 1.0;
  if (ratio >= 3) return 0.0;
  return Math.max(0, 1 - (ratio - 1) / 2);
}

/**
 * Freshness status for UI badges
 */
export function getFreshnessStatus(lastUpdated: Date, frequencyDays: number): "fresh" | "overdue" | "stale" {
  const freshness = getFreshness(lastUpdated, frequencyDays);
  if (freshness >= 0.8) return "fresh";
  if (freshness >= 0.3) return "overdue";
  return "stale";
}

/**
 * Calculate quality score for a data point
 */
export function calcQualityScore(type: string, lastUpdated: Date, frequencyDays?: number): number {
  const sourceWeight = SOURCE_WEIGHTS[type] ?? 0.5;
  const freq = frequencyDays ?? 30;
  const freshness = getFreshness(lastUpdated, freq);
  return sourceWeight * freshness;
}

/**
 * Calculate impact score for a data point
 */
export function calcImpactScore(
  type: string,
  changePercent: number | null | undefined,
  freshness: number
): number {
  const sourceWeight = SOURCE_WEIGHTS[type] ?? 0.5;
  const changeMag = Math.min(Math.abs(changePercent ?? 0) / 10, 1); // Normalize 0-10% to 0-1
  return sourceWeight * changeMag * freshness;
}

/**
 * Composite momentum calculation
 * Returns -100 to +100
 */
export function calcMomentum(components: {
  rate?: number;      // -100 to +100
  supply?: number;    // -100 to +100
  sentiment?: number; // -100 to +100
  economic?: number;  // -100 to +100
  market?: number;    // -100 to +100
}): number {
  const {
    rate = 0,
    supply = 0,
    sentiment = 0,
    economic = 0,
    market = 0,
  } = components;

  return (
    rate * 0.30 +
    supply * 0.25 +
    sentiment * 0.20 +
    economic * 0.15 +
    market * 0.10
  );
}
