/**
 * lib/leads/probate-score.ts
 *
 * Motivation score for probate-scan leads. Replaces the flat SCORE_PROBATE=70
 * that made every promoted probate signal unrankable (BACKLOG 2026-07-26).
 *
 * The factors object is persisted verbatim in Lead.scoreFactors so the score
 * can be recomputed later when a single input changes — the skip-trace import
 * flips hasPhone and calls this again rather than inventing its own bump.
 */

// Type alias (not interface) so the object satisfies Prisma's InputJsonValue.
export type ProbateScoreFactors = {
  signal: "probate";
  hasAddress: boolean;
  /** heirsJson holds at least one validated person name (someone callable). */
  hasHeirContact: boolean;
  /** ownerPhone present — set true by the skip-trace import. */
  hasPhone: boolean;
  estimatedValue: number | null;
  /** Days between obit (or signal creation) and promotion. Staleness decays. */
  signalAgeDays: number | null;
};

export function probateLeadScore(f: ProbateScoreFactors): number {
  let score = 55;
  if (f.hasAddress) score += 12;
  if (f.hasPhone) score += 10;
  if (f.hasHeirContact) score += 8;
  if (f.estimatedValue != null && f.estimatedValue > 0) score += 5;
  if (f.signalAgeDays != null) {
    if (f.signalAgeDays <= 14) score += 8;
    else if (f.signalAgeDays <= 45) score += 4;
  }
  return Math.min(score, 98);
}
