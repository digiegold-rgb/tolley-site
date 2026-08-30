import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  SCRIPT_GATE_ANIM_QUALITY,
  approveScriptFollowThrough,
  parseProduceEngine,
  scriptGateAnimFields,
  styleSeedFromStyle,
} from "./animate-render";
import { shouldPollJob } from "./youtube-status";
import { deriveCreateStep } from "./create-steps";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (rel: string) => readFileSync(join(root, rel), "utf8");

describe("1. Approve & Animate kicks produce", () => {
  it("Script Review engine → produce; Create step 5 with no engine still parks", () => {
    assert.deepEqual(approveScriptFollowThrough({ engine: "auto" }), {
      kick: "produce",
      engine: "auto",
    });
    assert.deepEqual(approveScriptFollowThrough({ engine: "fable5" }), {
      kick: "produce",
      engine: "fable5",
    });
    assert.deepEqual(approveScriptFollowThrough({}), { kick: "park" });
    assert.deepEqual(approveScriptFollowThrough({ engine: "jelly" }), { kick: "park" });
    assert.equal(parseProduceEngine("auto"), "auto");
    assert.equal(parseProduceEngine(undefined), null);
  });

  it("approve-script route calls produce when follow-through says so", () => {
    const src = read("app/api/vater/youtube/[id]/approve-script/route.ts");
    assert.match(src, /approveScriptFollowThrough/);
    assert.match(src, /produceApprovedProject/);
    assert.match(src, /follow\.kick === "produce"/);
    assert.match(src, /status === "awaiting_engine"/);
  });

  it("Script Review Approve sends engine (not approve-script alone)", () => {
    const src = read("components/animate/screens/review/ScriptReviewScreen.tsx");
    assert.match(src, /createApi\.approveScript\(project\.id, draft, engine\)/);
    assert.match(src, /createApi\.produce\(project\.id, engine\)/);
    assert.match(src, /review-engine-picker/);
  });
});

describe("2. scripted / editing with a live job is polled", () => {
  it("shouldPollJob treats scripted+job and editing+job as in-flight", () => {
    assert.equal(shouldPollJob({ status: "scripted", autopilotJobId: "job-1" }), true);
    assert.equal(shouldPollJob({ status: "editing", autopilotJobId: "job-2" }), true);
    assert.equal(shouldPollJob({ status: "queued", autopilotJobId: "job-3" }), true);
    assert.equal(shouldPollJob({ status: "queued" }), true);
  });

  it("does not poll parked scripted, terminals, or concierge", () => {
    assert.equal(shouldPollJob({ status: "scripted" }), false);
    assert.equal(shouldPollJob({ status: "scripted", autopilotJobId: null }), false);
    assert.equal(shouldPollJob({ status: "ready", autopilotJobId: "old" }), false);
    assert.equal(shouldPollJob({ status: "failed", autopilotJobId: "old" }), false);
    assert.equal(
      shouldPollJob({ status: "concierge_in_progress", autopilotJobId: "job" }),
      false,
    );
    assert.equal(
      shouldPollJob({ status: "awaiting_engine", autopilotJobId: "job" }),
      false,
    );
  });

  it("produce / public-api write queued so IN_FLIGHT kickers fire", () => {
    const produce = read("lib/vater/produce-project.ts");
    assert.match(produce, /status: "queued"/);
    assert.equal(/status: "scripted"/.test(produce), false);
    const api = read("lib/vater/public-api.ts");
    assert.match(api, /status: "queued"/);
    assert.equal(api.includes('status: "scripted"'), false);
  });

  it("approved queued is Create step 7 (Producing), not Writing", () => {
    const d = deriveCreateStep({
      status: "queued",
      scriptApprovedAt: new Date(),
      script: "approved copy",
      flowStep: 7,
    });
    assert.equal(d.step, 7);
    assert.equal(d.kind, "async");
    assert.equal(d.active, true);
  });

  it("kickers call shouldPollJob", () => {
    for (const rel of [
      "components/animate/screens/create/useCreatePoll.ts",
      "components/animate/ProgressBadgeProvider.tsx",
      "components/animate/screens/studio/Library.tsx",
      "components/animate/screens/review/ScriptReviewScreen.tsx",
      "components/animate/screens/editor/ProjectShell.tsx",
    ]) {
      assert.match(read(rel), /shouldPollJob/, rel);
    }
  });
});

describe("3. from-script seeds style + voice (F5-7HR425)", () => {
  it("styleSeedFromStyle copies preset and voice, not cinematic default", () => {
    const seed = styleSeedFromStyle({
      artStylePresetId: "pixar",
      voice: "Monroe",
      voiceCloneId: "clone-1",
    });
    assert.deepEqual(seed, {
      stylePreset: "pixar",
      voiceName: "Monroe",
      voiceCloneId: "clone-1",
    });
    assert.deepEqual(styleSeedFromStyle({}), {
      voiceName: null,
      voiceCloneId: null,
    });
  });

  it("from-script and from-transcript write the seed onto the row", () => {
    for (const rel of [
      "app/api/vater/youtube/from-script/route.ts",
      "app/api/vater/youtube/from-transcript/route.ts",
    ]) {
      const src = read(rel);
      assert.match(src, /styleSeedFromStyle/, rel);
      assert.match(src, /\.\.\.styleSeed/, rel);
    }
  });
});

describe("4. script-gate forwards Narrative animQuality", () => {
  it("animUntilS > 0 sends modal-wan22-narrative, not Action", () => {
    assert.deepEqual(scriptGateAnimFields(32), {
      defaultAnimUntilS: 32,
      animQuality: "modal-wan22-narrative",
    });
    assert.equal(scriptGateAnimFields(32).animQuality, SCRIPT_GATE_ANIM_QUALITY);
    assert.notEqual(scriptGateAnimFields(32).animQuality, "modal-wan22");
    assert.deepEqual(scriptGateAnimFields(0), {});
    assert.deepEqual(scriptGateAnimFields(null), {});
  });

  it("script-gate spreads scriptGateAnimFields onto the worker style", () => {
    const src = read("lib/vater/script-gate.ts");
    assert.match(src, /scriptGateAnimFields/);
    assert.match(src, /\.\.\.animFields/);
  });

  it("context/route accepts modal-* so Narrative is not remapped to Action", () => {
    const src = read("app/api/vater/youtube/[id]/context/route.ts");
    assert.match(src, /animationQualitySchema\.options/);
    assert.match(src, /modal-wan22-narrative/);
    const spec = read("lib/vater/video-spec.ts");
    assert.match(spec, /"modal-wan22-narrative"/);
    assert.match(spec, /"modal-wan22"/);
  });
});
