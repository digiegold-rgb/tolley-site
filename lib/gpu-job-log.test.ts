import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  attachGpuRoute,
  durationMsBetween,
  foldGpuJobLog,
  gpuJobFinishFields,
  gpuLogEntryFromFinish,
  mergeGpuJobLog,
  parseEtaToSeconds,
  parseGpuCostUsd,
  parseModalCostUsd,
} from "./gpu-job-log.ts";

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

    assert.equal(parseGpuCostUsd({ costs: { modalUsd: 0.41, totalUsd: 1.2 } }), 0.41);
    assert.equal(parseGpuCostUsd({ costs: { totalUsd: 1.2 } }), null);
  });
});

describe("parseEtaToSeconds", () => {
  it("reads existing product labels and returns null when empty", () => {
    assert.equal(parseEtaToSeconds("~5 min"), 300);
    assert.equal(parseEtaToSeconds("about 6 minutes"), 360);
    assert.equal(parseEtaToSeconds("~30 seconds"), 30);
    assert.equal(parseEtaToSeconds("10 seconds"), 10);
    assert.equal(parseEtaToSeconds("~90 s"), 90);
    assert.equal(parseEtaToSeconds(""), null);
    assert.equal(parseEtaToSeconds("soon"), null);
  });
});

describe("costJson gpuRoute / gpuLog", () => {
  it("stamps the route and appends logs without touching billing totals", () => {
    const billed = {
      totalUsd: 1.47,
      modalUsd: 1.39,
      byJob: { job_a: 1.47 },
    };
    const stamped = attachGpuRoute(billed, {
      backend: "modal",
      kind: "short-motion",
      reason: "test",
    });
    assert.equal(stamped.totalUsd, 1.47);
    assert.equal((stamped.gpuRoute as { kind: string }).kind, "short-motion");
    assert.equal(typeof (stamped.gpuRoute as { startedAt: string }).startedAt, "string");

    const started = new Date("2026-09-15T12:00:00.000Z");
    const done = new Date("2026-09-15T12:05:00.000Z");
    const finish = gpuJobFinishFields({
      startedAt: started,
      completedAt: done,
      result: { costs: { modalUsd: 0.22 } },
      backend: "modal",
    });
    const logged = mergeGpuJobLog(
      stamped,
      gpuLogEntryFromFinish("job_b", "short-motion", finish),
    );
    assert.ok(logged);
    assert.equal(logged.totalUsd, 1.47);
    assert.equal(logged.modalUsd, 1.39);
    assert.deepEqual(logged.byJob, { job_a: 1.47 });
    const rows = logged.gpuLog as { jobId: string; costUsd: number | null; durationMs: number | null }[];
    assert.equal(rows.length, 1);
    assert.equal(rows[0].jobId, "job_b");
    assert.equal(rows[0].costUsd, 0.22);
    assert.equal(rows[0].durationMs, 300_000);

    assert.equal(mergeGpuJobLog(logged, gpuLogEntryFromFinish("job_b", "short-motion", finish)), null);

    const folded = foldGpuJobLog(billed, billed, gpuLogEntryFromFinish("job_c", "still", finish));
    assert.ok(folded);
    assert.equal(folded.totalUsd, 1.47);
  });
});
