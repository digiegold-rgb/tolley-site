import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

describe("/generate fal engine tabs", () => {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const studio = readFileSync(join(root, "app/generate/generate-studio.tsx"), "utf8");
  const beatsUi = readFileSync(join(root, "app/generate/beat-queue.tsx"), "utf8");
  const jobs = readFileSync(join(root, "app/api/generate/jobs/route.ts"), "utf8");
  const poll = readFileSync(join(root, "app/api/generate/jobs/[id]/route.ts"), "utf8");
  const fal = readFileSync(join(root, "lib/fal.ts"), "utf8");

  it("routes t2i/t2v/i2v through generate jobs + fal, not Spark quickgen", () => {
    assert.match(studio, /"t2i"/);
    assert.match(studio, /"t2v"/);
    assert.match(studio, /kind: "i2v"/);
    assert.match(studio, /not wired on fal/i);
    assert.doesNotMatch(studio, /fetch\("\/api\/admin\/quickgen"/);
    assert.doesNotMatch(studio, /quickgen\.tolley\.io\/upload/);
    assert.match(jobs, /spawnFalT2I/);
    assert.match(jobs, /spawnFalT2V/);
    assert.match(jobs, /kind === "v2v"/);
    assert.match(poll, /pollFalImage/);
    assert.match(poll, /isFalVideoRecipe/);
    assert.match(fal, /fal-ai\/flux\/dev/);
    assert.match(fal, /enable_safety_checker: false/);
    assert.match(fal, /formatFalError/);
    assert.doesNotMatch(jobs, /scene_frames|lady-wan22/i);
  });

  it("keeps Modal stills and Motion spawn paths", () => {
    assert.match(jobs, /spawnQwenImageEdit/);
    assert.match(jobs, /spawnFalMotion/);
    assert.match(studio, /Modal stills/);
    assert.match(studio, /kind: "motion"/);
    assert.match(studio, /<GatedClip/);
    assert.match(studio, /\/api\/generate\/beats/);
    assert.match(studio, /patchBeatLocal/);
    assert.match(studio, /flushBeatPatchPersist/);
    assert.match(studio, /beatQueueRef/);
    assert.match(studio, /applyLocalBeatPatch/);
    assert.doesNotMatch(studio, /beatAction\("patch"/);
    assert.match(beatsUi, /Stitch approved beats/);
    assert.match(beatsUi, /0\.5× slow-mo/);
    assert.match(beatsUi, /<video/);
    assert.match(beatsUi, /controls/);
    assert.match(beatsUi, /gen-beat-strip/);
    assert.match(beatsUi, /aria-label="Beat timeline"/);
    assert.match(beatsUi, />\s*Left\s*</);
    assert.match(beatsUi, />\s*Right\s*</);
    assert.doesNotMatch(beatsUi, /gen-beat-list/);
    assert.doesNotMatch(beatsUi, />\s*Up\s*</);
    assert.doesNotMatch(beatsUi, />\s*Down\s*</);
  });

  it("lays the beat queue out as a horizontal filmstrip, not stacked cards", () => {
    const css = readFileSync(join(root, "app/generate/generate.css"), "utf8");
    assert.match(css, /\.gen-beat-strip\s*\{[^}]*flex-direction:\s*row/s);
    assert.match(css, /\.gen-beat-timeline\s*\{[^}]*overflow-x:\s*auto/s);
    assert.doesNotMatch(css, /\.gen-beat-list\s*\{[^}]*flex-direction:\s*column/s);
  });
});
