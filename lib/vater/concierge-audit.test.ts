import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  auditChipLabel,
  auditMatchesFinal,
  finalVersionOf,
  parseConciergeAudit,
  readConciergeClient,
  type ConciergeAudit,
} from "./concierge-client";

// The dict fable5-audit.py writes (F5-B0A50J audit-r1.json, trimmed).
const RAW_R1 = {
  ticket: "F5-B0A50J",
  round: 1,
  source: "r1",
  finalV: null,
  finalVideoUrl: null,
  jobId: "f3b7bdae28e64f19",
  projectId: "cmtdrna2s0002ko0a7kync65x",
  at: "2026-08-29T03:17:10Z",
  rulesVersion: { version: "2026-08-27.3", count: 160, source: "online" },
  sceneCount: 34,
  judged: 34,
  unjudged: [],
  hardFails: 29,
  hardScenes: [1, 2, 3, 5],
  byCheck: { text_english: 12, cast_match: 9 },
  costUsd: 2.5814,
  reportUrl: "https://gx10-adc6.taile5cde9.ts.net:8444/fable5-audit/F5-B0A50J/audit-r1.html",
  passed: true, // lies — must be recomputed
  scenes: [{ scene: 1 }],
};

describe("parseConciergeAudit", () => {
  it("reads the script's dict, recomputes passed, flattens rulesVersion", () => {
    const a = parseConciergeAudit(RAW_R1);
    assert.ok(a);
    assert.equal(a.round, 1);
    assert.equal(a.source, "r1");
    assert.equal(a.hardFails, 29);
    assert.equal(a.sceneCount, 34);
    assert.equal(a.passed, false);
    assert.equal(a.rulesVersion, "2026-08-27.3");
    assert.equal(a.reportUrl, RAW_R1.reportUrl);
    assert.deepEqual(a.hardScenes, [1, 2, 3, 5]);
    assert.deepEqual(a.byCheck, { text_english: 12, cast_match: 9 });
    assert.equal(a.costUsd, 2.5814);
  });

  it("passes only when hardFails is 0 AND every scene was judged", () => {
    assert.equal(parseConciergeAudit({ round: 2, hardFails: 0, sceneCount: 10, judged: 10 })?.passed, true);
    assert.equal(parseConciergeAudit({ round: 2, hardFails: 0, sceneCount: 10, judged: 9 })?.passed, false);
    assert.equal(parseConciergeAudit({ round: 2, hardFails: 1, sceneCount: 10, judged: 10 })?.passed, false);
  });

  it("rejects garbage and clips oversized lists / bad urls", () => {
    assert.equal(parseConciergeAudit(null), null);
    assert.equal(parseConciergeAudit("x"), null);
    assert.equal(parseConciergeAudit({ round: 0 }), null);
    assert.equal(parseConciergeAudit({ round: "nope" }), null);
    const big = parseConciergeAudit({
      round: 3,
      hardScenes: Array.from({ length: 900 }, (_, i) => i + 1),
      byCheck: Object.fromEntries(Array.from({ length: 80 }, (_, i) => [`c${i}`, 1])),
      reportUrl: "javascript:alert(1)",
      costUsd: "NaN",
    });
    assert.ok(big);
    assert.equal(big.hardScenes.length, 500);
    assert.equal(Object.keys(big.byCheck).length, 40);
    assert.equal(big.reportUrl, null);
    assert.equal(big.costUsd, 0);
  });

  it("round-trips through the ticket reader", () => {
    const t = readConciergeClient({
      engine: "fable5",
      concierge: { code: "F5-B0A50J", stage: "qa", audit: RAW_R1 },
    });
    assert.ok(t);
    assert.equal(t.audit?.round, 1);
    assert.equal(t.audit?.passed, false);
    assert.equal(readConciergeClient({ concierge: { code: "F5-B0A50J", stage: "qa" } })?.audit, null);
  });
});

describe("auditMatchesFinal — does the audit speak for THIS final?", () => {
  const FINAL = "https://blob.example/final.mp4?v=1756437000";
  const finalAudit = (over: Partial<ConciergeAudit> = {}): ConciergeAudit => ({
    ...parseConciergeAudit({ round: 2, source: "final", finalV: "1756437000", finalVideoUrl: FINAL, hardFails: 0, sceneCount: 34, judged: 34 })!,
    ...over,
  });
  const r1 = parseConciergeAudit(RAW_R1)!;

  it("extracts ?v=", () => {
    assert.equal(finalVersionOf(FINAL), "1756437000");
    assert.equal(finalVersionOf("https://x/y.mp4"), null);
    assert.equal(finalVersionOf(null), null);
  });

  it("matches on finalV or on the verbatim url", () => {
    assert.equal(auditMatchesFinal(finalAudit(), { finalVideoUrl: FINAL }), true);
    assert.equal(auditMatchesFinal(finalAudit({ finalVideoUrl: null }), { finalVideoUrl: FINAL }), true);
    assert.equal(auditMatchesFinal(finalAudit({ finalV: null }), { finalVideoUrl: FINAL }), true);
    // a repair compose bumped ?v= → the old final audit no longer counts
    assert.equal(auditMatchesFinal(finalAudit(), { finalVideoUrl: "https://blob.example/final.mp4?v=1756440000" }), false);
    assert.equal(auditMatchesFinal(finalAudit({ finalV: "1" }), { finalVideoUrl: "https://other/final.mp4?v=2" }), false);
  });

  it("an r1 audit counts only for the same render job with no repair compose since", () => {
    assert.equal(auditMatchesFinal(r1, { finalVideoUrl: FINAL, jobId: "f3b7bdae28e64f19", composeJobId: null }), true);
    assert.equal(auditMatchesFinal(r1, { finalVideoUrl: FINAL, jobId: "f3b7bdae28e64f19", composeJobId: "c0mp0se" }), false);
    assert.equal(auditMatchesFinal(r1, { finalVideoUrl: FINAL, jobId: "otherjob", composeJobId: null }), false);
    assert.equal(auditMatchesFinal(r1, { finalVideoUrl: FINAL }), false);
  });

  it("never matches without an audit or without a final", () => {
    assert.equal(auditMatchesFinal(null, { finalVideoUrl: FINAL }), false);
    assert.equal(auditMatchesFinal(finalAudit(), { finalVideoUrl: null }), false);
  });
});

describe("auditChipLabel", () => {
  it("reads like the board chip", () => {
    assert.equal(auditChipLabel(null), "no audit yet");
    assert.equal(auditChipLabel(parseConciergeAudit(RAW_R1)), "audit r1 FAIL 29/34");
    assert.equal(auditChipLabel(parseConciergeAudit({ round: 2, hardFails: 0, sceneCount: 3, judged: 3 })), "audit r2 PASS");
  });
});
