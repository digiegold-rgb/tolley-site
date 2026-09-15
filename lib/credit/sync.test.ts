import assert from "node:assert/strict";
import test from "node:test";
import {
  applyMortgageToEquity,
  normalizeDisputeBody,
  normalizeScorePost,
  resolveAltBureaus,
} from "./sync";
import { DEFAULT_ALT_BUREAUS } from "./types";

test("normalizeScorePost defaults missing source to manual", () => {
  const out = normalizeScorePost({
    date: "2026-09-15",
    transunion: 701,
  });
  assert.equal(out.source, "manual");
  assert.deepEqual(out.sources, { transunion: "manual" });
  assert.equal(out.transunion, 701);
  assert.equal(out.equifax, undefined);
  assert.equal(out.experian, undefined);
});

test("normalizeScorePost never invents bureau scores", () => {
  const out = normalizeScorePost({ date: "2026-09-15" });
  assert.equal(out.source, "manual");
  assert.deepEqual(out.sources, {});
  assert.equal("transunion" in out, false);
  assert.equal("equifax" in out, false);
  assert.equal("experian" in out, false);
  assert.equal("kickoff_score" in out, false);
});

test("normalizeScorePost preserves an explicit source", () => {
  const out = normalizeScorePost({
    date: "2026-09-15",
    experian: 690,
    source: "annualcreditreport",
  });
  assert.equal(out.source, "annualcreditreport");
  assert.deepEqual(out.sources, { experian: "annualcreditreport" });
});

test("normalizeScorePost keeps existing per-bureau sources", () => {
  const out = normalizeScorePost({
    equifax: 680,
    sources: { equifax: "kikoff" },
  });
  assert.equal(out.source, "manual");
  assert.deepEqual(out.sources, { equifax: "kikoff" });
});

test("normalizeDisputeBody aliases filedDate and sentDate", () => {
  const fromFiled = normalizeDisputeBody({
    creditor: "JPMCB",
    filedDate: "2026-09-15",
    fileNumber: "1911988492",
    channel: "online",
    accountLast4: null,
    caseNumber: null,
  });
  assert.equal(fromFiled.sentDate, "2026-09-15");
  assert.equal(fromFiled.filedDate, "2026-09-15");
  assert.equal(fromFiled.fileNumber, "1911988492");
  assert.deepEqual(fromFiled.docs, []);

  const fromSent = normalizeDisputeBody({
    creditor: "PNC",
    sentDate: "2026-09-15",
  });
  assert.equal(fromSent.filedDate, "2026-09-15");
  assert.equal(fromSent.sentDate, "2026-09-15");
});

test("applyMortgageToEquity uses snapshot balance when present", () => {
  const equity = applyMortgageToEquity(
    {
      homeValue: 200000,
      mortgageBalance: 90000,
      equity: 110000,
      available80: 70000,
      available85: 80000,
      met: true,
    },
    {
      lender: "M&T",
      accountLast4: "1234",
      balance: 72000,
      principalAndInterest: null,
      escrow: null,
      totalPayment: null,
      nextDueDate: null,
      ratePct: null,
      pmiActive: null,
      aheadOfSchedule: null,
      lastSyncAt: null,
      source: "statement",
    }
  );
  assert.equal(equity.mortgageBalance, 72000);
  assert.equal(equity.equity, 128000);
  assert.equal(equity.available80, 88000);
  assert.equal(equity.available85, 98000);
  assert.equal(equity.pmiActive, undefined);
});

test("applyMortgageToEquity leaves equity alone without a balance", () => {
  const original = {
    homeValue: 200000,
    mortgageBalance: 90000,
    equity: 110000,
    available80: 70000,
    available85: 80000,
    met: true,
  };
  assert.deepEqual(applyMortgageToEquity(original, null), original);
  assert.deepEqual(
    applyMortgageToEquity(original, {
      lender: "M&T",
      accountLast4: null,
      balance: null,
      principalAndInterest: null,
      escrow: null,
      totalPayment: null,
      nextDueDate: null,
      ratePct: null,
      pmiActive: null,
      aheadOfSchedule: null,
      lastSyncAt: null,
      source: null,
    }),
    original
  );
});

test("resolveAltBureaus falls back to not_started placeholders", () => {
  assert.deepEqual(resolveAltBureaus(undefined), DEFAULT_ALT_BUREAUS);
  assert.deepEqual(resolveAltBureaus([]), DEFAULT_ALT_BUREAUS);
  assert.equal(DEFAULT_ALT_BUREAUS.every((b) => b.score === null), true);
  assert.equal(
    DEFAULT_ALT_BUREAUS.every((b) => b.status === "not_started"),
    true
  );
});
