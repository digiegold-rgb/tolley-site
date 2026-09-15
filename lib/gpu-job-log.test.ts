import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { durationMsBetween, gpuJobFinishFields, parseModalCostUsd } from "./gpu-job-log.ts";

describe("parseModalCostUsd", () => {
  it("reads cost_usd / costUsd / usage.cost_usd and returns null when missing", () => {
    assert.equal(parseModalCostUsd(null), null);
    assert.equal(parseModalCostUsd({ status: "done" }), null);
    assert.equal(parseModalCostUsd({ cost_usd: 0.0412 }), 0.0412);
    assert.equal(parseModalCostUsd({ costUsd: 1.5 }), 1.5);
    assert.equal(parseModalCostUsd({ usage: { cost_usd: 0.002 } }), 0.002);
    assert.equal(parseModalCostUsd({ cost: 0 }), 0);
    assert.equal(parseModalCostUsd({ cost_usd: -1 }), null);
    assert.equal(parseModalCostUsd({ cost_usd: Number.NaN }), null);
    assert.equal(parseModalCostUsd({ cost_usd: "0.4" }), null);
  });
});

describe("durationMsBetween / gpuJobFinishFields", () => {
  it("computes wall time and keeps cost nullable", () => {
    const started = new Date("2026-09-15T12:00:00.000Z");
    const done = new Date("2026-09-15T12:02:03.250Z");
    assert.equal(durationMsBetween(started, done), 123250);
    assert.equal(durationMsBetween(null, done), null);
    assert.equal(durationMsBetween(done, started), null);

    const logged = gpuJobFinishFields({
      startedAt: started,
      completedAt: done,
      result: { status: "done", cost_usd: 0.18 },
      backend: "modal",
    });
    assert.equal(logged.backend, "modal");
    assert.equal(logged.durationMs, 123250);
    assert.equal(logged.costUsd, 0.18);
    assert.equal(logged.completedAt.getTime(), done.getTime());

    const empty = gpuJobFinishFields({ startedAt: started, completedAt: done, result: { status: "done" } });
    assert.equal(empty.costUsd, null);
    assert.equal(empty.backend, "modal");
  });
});
