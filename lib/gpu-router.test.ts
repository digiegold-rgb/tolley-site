import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  GPU_BACKENDS,
  GPU_JOB_KINDS,
  NEBIUS_NOT_WIRED,
  NEBIUS_RUNTIME_SEC,
  gpuKindForMotionEstimate,
  requireWiredGpuBackend,
  routeGpuJob,
} from "./gpu-router.ts";

describe("routeGpuJob", () => {
  it("sends stills and short-motion to Modal when runtime is unknown or under 20 minutes", () => {
    for (const kind of ["still", "short-motion"] as const) {
      assert.deepEqual(routeGpuJob({ kind }).backend, "modal");
      assert.equal(routeGpuJob({ kind, estimatedRuntimeSec: null }).backend, "modal");
      assert.equal(routeGpuJob({ kind, estimatedRuntimeSec: 0 }).backend, "modal");
      assert.equal(routeGpuJob({ kind, estimatedRuntimeSec: 1199 }).backend, "modal");
      assert.equal(routeGpuJob({ kind, estimatedRuntimeSec: Number.NaN }).backend, "modal");
      assert.equal(routeGpuJob({ kind, estimatedRuntimeSec: -4 }).backend, "modal");
    }
    const still = routeGpuJob({ kind: "still" });
    assert.equal(still.kind, "still");
    assert.match(still.reason, /Modal short path/);
    assert.doesNotMatch(still.reason, /spark/i);
  });

  it("maps motion length estimates to short-motion vs long-video", () => {
    assert.equal(gpuKindForMotionEstimate(null), "short-motion");
    assert.equal(gpuKindForMotionEstimate(12), "short-motion");
    assert.equal(gpuKindForMotionEstimate(1199), "short-motion");
    assert.equal(gpuKindForMotionEstimate(NEBIUS_RUNTIME_SEC), "long-video");
    assert.equal(gpuKindForMotionEstimate(20 * 60 + 1), "long-video");
    assert.equal(routeGpuJob({ kind: gpuKindForMotionEstimate(30), estimatedRuntimeSec: 30 }).backend, "modal");
    assert.equal(routeGpuJob({ kind: gpuKindForMotionEstimate(NEBIUS_RUNTIME_SEC) }).backend, "nebius");
  });

  it("sends estimated runtime ≥ 20 minutes to Nebius (stub)", () => {
    assert.equal(NEBIUS_RUNTIME_SEC, 20 * 60);
    const hit = routeGpuJob({ kind: "still", estimatedRuntimeSec: NEBIUS_RUNTIME_SEC });
    assert.equal(hit.backend, "nebius");
    assert.match(hit.reason, /1200s/);
    assert.equal(routeGpuJob({ kind: "short-motion", estimatedRuntimeSec: 20 * 60 + 1 }).backend, "nebius");
  });

  it("sends long-video and batch to Nebius even with a short estimate", () => {
    assert.equal(routeGpuJob({ kind: "long-video", estimatedRuntimeSec: 12 }).backend, "nebius");
    assert.equal(routeGpuJob({ kind: "batch", estimatedRuntimeSec: 1 }).backend, "nebius");
    assert.match(routeGpuJob({ kind: "long-video" }).reason, /long-video/);
    assert.match(routeGpuJob({ kind: "batch" }).reason, /batch/);
  });

  it("ignores queue depth in v1", () => {
    const deep = routeGpuJob({ kind: "still", queueDepth: 99, estimatedRuntimeSec: 30 });
    assert.equal(deep.backend, "modal");
    const deepLong = routeGpuJob({ kind: "batch", queueDepth: 0 });
    assert.equal(deepLong.backend, "nebius");
  });

  it("never lists Spark as a backend and has no LLM", () => {
    assert.deepEqual([...GPU_BACKENDS], ["modal", "nebius"]);
    assert.deepEqual([...GPU_JOB_KINDS], ["still", "short-motion", "long-video", "batch"]);
    assert.equal((GPU_BACKENDS as readonly string[]).includes("spark"), false);
    const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "gpu-router.ts"), "utf8");
    assert.doesNotMatch(src, /openai|anthropic|litellm|chat\.completions/i);
    assert.doesNotMatch(src, /backend:\s*["']spark["']/);
  });
});

describe("requireWiredGpuBackend", () => {
  it("allows Modal and throws a clear not-wired error for Nebius", () => {
    requireWiredGpuBackend({ backend: "modal", kind: "still", reason: "test" });
    assert.throws(
      () => requireWiredGpuBackend({ backend: "nebius", kind: "batch", reason: "kind is batch — reserved for Nebius (not wired)" }),
      (err: unknown) => {
        assert.ok(err instanceof Error);
        assert.match(err.message, /not wired/i);
        assert.match(err.message, /batch/);
        assert.equal(err.message.startsWith(NEBIUS_NOT_WIRED), true);
        assert.doesNotMatch(err.message, /spark/i);
        return true;
      },
    );
  });
});
