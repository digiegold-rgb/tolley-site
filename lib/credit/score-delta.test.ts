import assert from "node:assert/strict";
import test from "node:test";
import { bureauScoreDelta, deltaForDisplayedScore } from "./score-delta";
import type { BureauReading, ScoreHistoryEntry } from "./types";

const ficoLatest: ScoreHistoryEntry = {
  date: "2026-10-26",
  experian: 607,
  model: "FICO Score 8",
  models: { experian: "FICO Score 8" },
};

const vantagePrevious: ScoreHistoryEntry = {
  date: "2026-09-01",
  experian: 644,
  model: "VantageScore 3.0",
  models: { experian: "VantageScore 3.0" },
};

function reading(
  partial: Pick<BureauReading, "value" | "previous" | "change" | "model" | "date">
): BureauReading {
  return {
    source: null,
    pulledAt: null,
    ageDays: null,
    ...partial,
  };
}

test("hides the Experian delta when FICO 8 replaces VantageScore 3.0", () => {
  const delta = bureauScoreDelta({
    bureau: "experian",
    latest: ficoLatest,
    previous: vantagePrevious,
    reading: reading({
      value: 607,
      date: "2026-10-26",
      previous: 644,
      change: -37,
      model: "FICO Score 8",
    }),
  });
  assert.equal(delta.change, null);
  assert.equal(delta.note, "new model: FICO 8");
  assert.equal(delta.modelLabel, "FICO 8");
});

test("keeps a delta when both readings are FICO 8, including the short label", () => {
  const delta = bureauScoreDelta({
    bureau: "experian",
    latest: {
      date: "2026-10-26",
      experian: 620,
      models: { experian: "FICO Score 8" },
    },
    previous: {
      date: "2026-09-01",
      experian: 607,
      model: "FICO 8",
    },
    reading: reading({
      value: 620,
      date: "2026-10-26",
      previous: 607,
      change: 13,
      model: "FICO Score 8",
    }),
  });
  assert.equal(delta.change, 13);
  assert.equal(delta.note, null);
  assert.equal(delta.modelLabel, "FICO 8");
});

test("uses per-bureau models ahead of the entry-level model", () => {
  const delta = bureauScoreDelta({
    bureau: "transunion",
    latest: {
      date: "2026-10-26",
      transunion: 700,
      model: "VantageScore 3.0",
      models: { transunion: "FICO Score 8" },
    },
    previous: {
      date: "2026-09-01",
      transunion: 680,
      model: "FICO Score 8",
    },
    reading: reading({
      value: 700,
      date: "2026-10-26",
      previous: 680,
      change: 20,
      model: null,
    }),
  });
  assert.equal(delta.change, 20);
  assert.equal(delta.modelLabel, "FICO 8");
});

test("reads the Kikoff model from models.kickoff", () => {
  const delta = bureauScoreDelta({
    bureau: "kickoff_score",
    latest: {
      date: "2026-10-26",
      kickoff_score: 90,
      models: { kickoff: "Kikoff" },
    },
    previous: {
      date: "2026-09-01",
      kickoff_score: 80,
      models: { kickoff_score: "Kikoff" },
    },
    reading: reading({
      value: 90,
      date: "2026-10-26",
      previous: 80,
      change: 10,
      model: null,
    }),
  });
  assert.equal(delta.change, 10);
  assert.equal(delta.note, null);
});

test("keeps an unlabeled legacy delta", () => {
  const delta = bureauScoreDelta({
    bureau: "equifax",
    latest: { date: "2026-04-05", equifax: 649 },
    previous: { date: "2026-03-23", equifax: 639 },
    reading: reading({
      value: 649,
      date: "2026-04-05",
      previous: 639,
      change: 10,
      model: null,
    }),
  });
  assert.equal(delta.change, 10);
  assert.equal(delta.note, null);
  assert.equal(delta.modelLabel, null);
});

test("does not repeat a ledger delta whose earlier model is not on the dashboard", () => {
  const delta = bureauScoreDelta({
    bureau: "experian",
    latest: { date: "2026-10-26", transunion: 660, model: "FICO Score 8" },
    previous: { date: "2026-09-01", transunion: 650, model: "FICO Score 8" },
    reading: reading({
      value: 607,
      date: "2026-08-01",
      previous: 644,
      change: -37,
      model: "FICO Score 8",
    }),
  });
  assert.equal(delta.change, null);
  assert.equal(delta.note, null);
  assert.equal(delta.modelLabel, "FICO 8");
});

test("headline score follows the same bureau model rule", () => {
  const perBureau = {
    experian: reading({
      value: 607,
      date: "2026-10-26",
      previous: 644,
      change: -37,
      model: "FICO Score 8",
    }),
    transunion: reading({
      value: 660,
      date: "2026-10-26",
      previous: 650,
      change: 10,
      model: "FICO Score 8",
    }),
  };
  const switched = deltaForDisplayedScore({
    score: 607,
    perBureau,
    latest: { ...ficoLatest, transunion: 660, models: { ...ficoLatest.models, transunion: "FICO Score 8" } },
    previous: { ...vantagePrevious, transunion: 650, models: { ...vantagePrevious.models, transunion: "FICO Score 8" } },
  });
  assert.equal(switched.bureau, "experian");
  assert.equal(switched.change, null);
  assert.equal(switched.note, "new model: FICO 8");

  const same = deltaForDisplayedScore({
    score: 660,
    perBureau,
    latest: {
      date: "2026-10-26",
      transunion: 660,
      experian: 607,
      models: { transunion: "FICO Score 8", experian: "FICO Score 8" },
    },
    previous: {
      date: "2026-09-01",
      transunion: 650,
      experian: 644,
      models: { transunion: "FICO Score 8", experian: "VantageScore 3.0" },
    },
  });
  assert.equal(same.bureau, "transunion");
  assert.equal(same.change, 10);
  assert.equal(same.note, null);
});
