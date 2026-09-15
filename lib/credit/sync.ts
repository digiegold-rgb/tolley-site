import type { HelocEquity, MortgageSnapshot } from "./types";
import { DEFAULT_ALT_BUREAUS } from "./types";

const SCORE_KEYS = ["transunion", "equifax", "experian", "kickoff_score"] as const;

const SOURCE_ALIAS: Record<(typeof SCORE_KEYS)[number], string> = {
  transunion: "transunion",
  equifax: "equifax",
  experian: "experian",
  kickoff_score: "kickoff",
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

/**
 * Manual score POSTs must carry a source. Missing source defaults to "manual".
 * Never invent bureau values — only pass through what the client sent.
 */
export function normalizeScorePost(
  body: Record<string, unknown>
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...body };

  if (next.source == null || next.source === "") {
    next.source = "manual";
  }

  const sources = isPlainObject(next.sources) ? { ...next.sources } : {};

  for (const key of SCORE_KEYS) {
    const raw = next[key];
    if (raw == null || raw === "") continue;
    const alias = SOURCE_ALIAS[key];
    if (sources[alias] == null && sources[key] == null) {
      sources[alias] = next.source;
    }
  }

  next.sources = sources;
  return next;
}

/**
 * Keep filedDate ↔ sentDate aliased so older UI and Credit Desk stay in sync.
 * Passes through additive fields (fileNumber, channel, docs, etc.).
 */
export function normalizeDisputeBody(
  body: Record<string, unknown>
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...body };
  const filed =
    typeof next.filedDate === "string" && next.filedDate
      ? next.filedDate
      : null;
  const sent =
    typeof next.sentDate === "string" && next.sentDate ? next.sentDate : null;

  if (filed && !sent) next.sentDate = filed;
  if (sent && !filed) next.filedDate = sent;

  if (next.docs == null) next.docs = [];
  if (!Array.isArray(next.docs)) next.docs = [];

  return next;
}

/** Prefer a live mortgage snapshot balance over stale heloc equity. */
export function applyMortgageToEquity(
  equity: HelocEquity,
  mortgage?: MortgageSnapshot | null
): HelocEquity {
  if (!mortgage || mortgage.balance == null) return equity;

  const mortgageBalance = mortgage.balance;
  const homeValue = equity.homeValue;
  const computedEquity =
    homeValue != null ? homeValue - mortgageBalance : equity.equity;
  const available80 =
    homeValue != null
      ? Math.max(0, homeValue * 0.8 - mortgageBalance)
      : equity.available80;
  const available85 =
    homeValue != null
      ? Math.max(0, homeValue * 0.85 - mortgageBalance)
      : equity.available85;

  return {
    ...equity,
    mortgageBalance,
    equity: computedEquity,
    available80,
    available85,
  };
}

export function resolveAltBureaus<T extends { id: string }>(
  incoming?: T[] | null
): T[] | typeof DEFAULT_ALT_BUREAUS {
  if (incoming && incoming.length > 0) return incoming;
  return DEFAULT_ALT_BUREAUS;
}
