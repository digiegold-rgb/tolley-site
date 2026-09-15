import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel: string) => readFileSync(join(root, rel), "utf8");

describe("GPU router v2 surface wiring", () => {
  it("calls routeGpuJob / requireWiredGpuBackend on Animate kickoff paths", () => {
    const kickoff = read("lib/vater/animate-all-kickoff.ts");
    assert.match(kickoff, /routeAnimateGpuJob/);
    assert.match(kickoff, /requireWiredGpuBackend/);
    assert.match(kickoff, /attachGpuRoute/);
    assert.doesNotMatch(kickoff, /backend:\s*["']spark["']/);

    const animate = read("app/api/vater/youtube/[id]/scene/animate/route.ts");
    assert.match(animate, /routeAnimateGpuJob/);
    assert.match(animate, /requireWiredGpuBackend/);
    assert.match(animate, /foldGpuJobLog|gpuLogEntryFromFinish/);

    const gate = read("lib/vater/script-gate.ts");
    assert.match(gate, /routeFilmProduceGpuJob/);
    assert.match(gate, /requireWiredGpuBackend/);
    assert.match(gate, /attachGpuRoute/);
  });

  it("logs duration + cost on Animate finalize / poll without inventing Spark", () => {
    const finalize = read("lib/vater/animate-all-finalize.ts");
    assert.match(finalize, /foldGpuJobLog/);
    assert.match(finalize, /gpuJobFinishFields/);
    assert.match(finalize, /mergeVideoCost/);

    const sync = read("lib/vater/project-sync.ts");
    assert.match(sync, /foldGpuJobLog/);
    assert.match(sync, /gpuJobFinishFields/);
    assert.doesNotMatch(sync, /backend:\s*["']spark["']/);
  });

  it("gates realestate generate + listing Modal/fal kickoffs", () => {
    const generate = read("app/api/video/generate/route.ts");
    assert.match(generate, /routeVideoGenerateGpuJob/);
    assert.match(generate, /requireWiredGpuBackend/);
    assert.match(generate, /submitVideoGeneration/);
    assert.match(generate, /backend: gpuRoute.backend/);

    const studio = read("app/api/video/studio-generate/route.ts");
    assert.match(studio, /routeStudioGenerateGpuJob/);
    assert.match(studio, /requireWiredGpuBackend/);

    const status = read("app/api/video/status/route.ts");
    assert.match(status, /gpuJobFinishFields/);

    const stage = read("app/api/vater/listing/[id]/stage/route.ts");
    assert.match(stage, /routeListingGpuJob/);
    assert.match(stage, /requireWiredGpuBackend/);
    assert.match(stage, /attachGpuRoute/);

    const approve = read("app/api/vater/listing/[id]/approve-still/route.ts");
    assert.match(approve, /routeListingGpuJob/);
    assert.match(approve, /requireWiredGpuBackend/);

    const poll = read("app/api/vater/listing/[id]/poll/route.ts");
    assert.match(poll, /foldGpuJobLog/);
    assert.match(poll, /requireWiredGpuBackend/);
  });

  it("does not add Spark to the router or rewrite billing totals in helpers", () => {
    const router = read("lib/gpu-router.ts");
    assert.doesNotMatch(router, /backend:\s*["']spark["']/);
    assert.doesNotMatch(router, /openai|anthropic|litellm|chat\.completions/i);

    const log = read("lib/gpu-job-log.ts");
    assert.match(log, /Never writes or rewrites totalUsd/);
    assert.match(log, /parseGpuCostUsd/);
  });
});
