import test from "node:test";
import assert from "node:assert/strict";
import {
  centsToUsd,
  dueUsdWithScript,
  scriptBreakdownRow,
  scriptDueSlice,
  sumScriptCents,
  sumScriptCentsSince,
} from "./script-due";

/** Tonight's Fable generate: 7396+4513 tokens, quoted 20¢ billed 39¢. */
const TONIGHT = { costCents: 39, ts: new Date("2026-08-30T02:10:00.000Z") };
const OLDER = { costCents: 25, ts: new Date("2026-08-01T12:00:00.000Z") };
const LAST_PAY = new Date("2026-08-20T00:00:00.000Z");

test("dueUsd adds unpaid script usage the moment the VaterUsage row exists", () => {
  assert.equal(centsToUsd(39), 0.39);
  assert.equal(dueUsdWithScript(93.62, 0.39), 94.01);
  assert.equal(dueUsdWithScript(93.62, 0), 93.62);
  assert.equal(sumScriptCents([TONIGHT, OLDER]), 64);
  assert.equal(sumScriptCentsSince([TONIGHT, OLDER], LAST_PAY), 39);
});

test("Script row appears for new-since-payment activity when the snapshot has no scriptUsd", () => {
  const slice = scriptDueSlice({
    rows: [TONIGHT, OLDER],
    lastPayment: { createdAt: LAST_PAY, snapshotJson: { computeUsd: 90, opsUsd: 3, breakdown: [] } },
  });
  assert.equal(slice.basis, "activity");
  assert.equal(slice.allUsd, 0.64);
  assert.equal(slice.sinceUsd, 0.39);
  const row = scriptBreakdownRow(slice.sinceUsd);
  assert.ok(row);
  assert.equal(row!.key, "script");
  assert.equal(row!.label, "Script");
  assert.equal(row!.usd, 0.39);
});

test("a payment snapshot with scriptUsd makes the next diff exact", () => {
  const slice = scriptDueSlice({
    rows: [TONIGHT, OLDER],
    lastPayment: {
      createdAt: LAST_PAY,
      snapshotJson: { scriptUsd: 0.25, computeUsd: 90, breakdown: [] },
    },
  });
  assert.equal(slice.basis, "snapshot");
  assert.equal(slice.allUsd, 0.64);
  assert.equal(slice.sinceUsd, 0.39);
});

test("never paid: every script VaterUsage row is due", () => {
  const slice = scriptDueSlice({ rows: [TONIGHT, OLDER], lastPayment: null });
  assert.equal(slice.basis, "all-time");
  assert.equal(slice.sinceUsd, 0.64);
  assert.equal(scriptBreakdownRow(0), null);
});
