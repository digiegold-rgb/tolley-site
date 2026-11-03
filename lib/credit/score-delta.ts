import type {
  BureauReading,
  ScoreBureau,
  ScoreHistoryEntry,
} from "./types";

export type BureauDelta = {
  /** Point change versus the previous reading. Null unless that reading used the same model. */
  change: number | null;
  modelLabel: string | null;
  /** Set when the earlier reading used a different model. */
  note: string | null;
};

/** Fold "FICO Score 8" and "FICO 8" (and VantageScore / Vantage Score) into one key. */
export function modelKey(model: string): string {
  return model.toLowerCase().replace(/score/g, "").replace(/[^a-z0-9.]+/g, "");
}

/** "FICO Score 8" → "FICO 8". Leaves "VantageScore 3.0" intact. */
export function shortModelLabel(model: string): string {
  return model.replace(/\bscore\b/gi, " ").replace(/\s+/g, " ").trim();
}

/**
 * Ledger resolution order: per-bureau `models`, then the entry-level `model`.
 * Kikoff is stored as `kickoff_score` on the reading and sometimes `kickoff` in `models`.
 */
export function entryModel(
  entry: ScoreHistoryEntry | null | undefined,
  bureau: ScoreBureau
): string | null {
  if (!entry?.models && !entry?.model) return null;
  const models = entry.models;
  if (models && typeof models === "object") {
    const direct = models[bureau];
    if (typeof direct === "string" && direct.trim()) return direct.trim();
    if (bureau === "kickoff_score") {
      const alias = models.kickoff;
      if (typeof alias === "string" && alias.trim()) return alias.trim();
    }
  }
  if (typeof entry.model === "string" && entry.model.trim()) return entry.model.trim();
  return null;
}

function entryScore(
  entry: ScoreHistoryEntry | null | undefined,
  bureau: ScoreBureau
): number | null {
  if (!entry) return null;
  const raw = entry[bureau];
  if (typeof raw !== "number" || !Number.isFinite(raw)) return null;
  return raw;
}

function pickEntry(
  entries: Array<ScoreHistoryEntry | null | undefined>,
  bureau: ScoreBureau,
  value: number | null,
  date: string | null
): ScoreHistoryEntry | null {
  if (value == null) return null;
  const matches = entries.filter(
    (entry): entry is ScoreHistoryEntry => entryScore(entry, bureau) === value
  );
  if (date) {
    const dated = matches.find((entry) => entry.date === date);
    if (dated) return dated;
  }
  return matches[0] ?? null;
}

/**
 * The ledger's `perBureau.*.change` and `scores.trend` subtract the previous
 * number without comparing models. Callers should display this result instead.
 */
export function bureauScoreDelta(input: {
  bureau: ScoreBureau;
  reading?: Pick<BureauReading, "value" | "date" | "model" | "previous" | "change"> | null;
  latest?: ScoreHistoryEntry | null;
  previous?: ScoreHistoryEntry | null;
}): BureauDelta {
  const reading = input.reading;
  const value = reading?.value ?? null;
  const ledgerChange = reading?.change ?? null;
  const priorValue = reading?.previous ?? null;

  const currentEntry = pickEntry(
    [input.latest, input.previous],
    input.bureau,
    value,
    reading?.date ?? null
  );
  const fromReading =
    typeof reading?.model === "string" && reading.model.trim()
      ? reading.model.trim()
      : null;
  const currentModel =
    fromReading ||
    entryModel(currentEntry, input.bureau) ||
    entryModel(input.latest, input.bureau) ||
    null;
  const modelLabel = currentModel ? shortModelLabel(currentModel) : null;

  if (priorValue == null || value == null) {
    return { change: null, modelLabel, note: null };
  }

  const priorEntry = pickEntry(
    [input.latest, input.previous].filter((entry) => entry && entry !== currentEntry),
    input.bureau,
    priorValue,
    null
  );

  if (!priorEntry) {
    // Change may refer to an older row than the two entries on the dashboard.
    // Once this pull is labeled, don't repeat a delta whose model we can't see.
    if (!currentModel) return { change: ledgerChange, modelLabel: null, note: null };
    return { change: null, modelLabel, note: null };
  }

  const previousModel = entryModel(priorEntry, input.bureau);
  if (currentModel && previousModel) {
    if (modelKey(currentModel) === modelKey(previousModel)) {
      return { change: value - priorValue, modelLabel, note: null };
    }
    return { change: null, modelLabel, note: `new model: ${modelLabel}` };
  }

  if (!currentModel && !previousModel) {
    return { change: value - priorValue, modelLabel: null, note: null };
  }

  return { change: null, modelLabel, note: null };
}

const BUREAU_ORDER: ScoreBureau[] = [
  "transunion",
  "equifax",
  "experian",
  "kickoff_score",
];

/** Bureau whose displayed value is `score` (first match in TU, EQ, EX, Kikoff order). */
export function deltaForDisplayedScore(input: {
  score: number | null;
  perBureau?: Partial<Record<ScoreBureau, BureauReading>> | null;
  latest?: ScoreHistoryEntry | null;
  previous?: ScoreHistoryEntry | null;
}): BureauDelta & { bureau: ScoreBureau | null } {
  if (input.score == null || !input.perBureau) {
    return { bureau: null, change: null, modelLabel: null, note: null };
  }
  for (const bureau of BUREAU_ORDER) {
    const reading = input.perBureau[bureau];
    if (reading?.value !== input.score) continue;
    return {
      bureau,
      ...bureauScoreDelta({
        bureau,
        reading,
        latest: input.latest,
        previous: input.previous,
      }),
    };
  }
  return { bureau: null, change: null, modelLabel: null, note: null };
}
