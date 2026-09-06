import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { applyLocalBeatPatch, emptyBeatQueue } from "./generate-beats.ts";
import { emptyMotionCard } from "./generate-motion-card.ts";
import {
  beatPromptEditorForIndex,
  copyBeatAsNewDraft,
  ensureBeat1,
  motionCardFromBeat1,
  motionCardMatchesBeat1,
  writeMotionCardToBeat1,
} from "./generate-studio-motion-sync.ts";

const STILL = "https://blob.example/generate/lady2.png";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("studio motionCard ↔ beats[0]", () => {
  it("auto-seeds Beat 1 from the motion card when the queue is empty", () => {
    const card = { ...emptyMotionCard(), prompt: "soft smile", source_image_url: STILL, slow_mo: true };
    const q = ensureBeat1(emptyBeatQueue(), card);
    assert.equal(q.beats.length, 1);
    assert.equal(motionCardMatchesBeat1(card, q), true);
    assert.equal(ensureBeat1(q, { ...card, prompt: "other" }).beats[0].id, q.beats[0].id);
  });

  it("writes the main Motion fields into beats[0] and reads them back", () => {
    const card = {
      ...emptyMotionCard(),
      prompt: "she turns to camera",
      source_image_url: STILL,
      end_image_url: STILL,
      seed: 7,
      slow_mo: true,
    };
    const q = writeMotionCardToBeat1(emptyBeatQueue(), card);
    assert.equal(q.beats.length, 1);
    assert.equal(q.beats[0].prompt, "she turns to camera");
    assert.equal(q.beats[0].source_image_url, STILL);
    assert.equal(q.beats[0].end_image_url, STILL);
    assert.equal(q.beats[0].slow_mo, true);
    assert.equal(q.beats[0].seed, 7);
    const back = motionCardFromBeat1(q);
    assert.equal(back.prompt, card.prompt);
    assert.equal(back.source_image_url, STILL);
    assert.equal(back.slow_mo, true);
    assert.equal(motionCardMatchesBeat1(back, q), true);
  });

  it("keeps one prompt for Beat 1 — form write and strip patch are the same beat", () => {
    let q = writeMotionCardToBeat1(emptyBeatQueue(), {
      ...emptyMotionCard(),
      prompt: "from the form",
      source_image_url: STILL,
    });
    q = applyLocalBeatPatch(q, q.beats[0].id, { prompt: "from the strip" });
    const card = motionCardFromBeat1(q);
    assert.equal(card.prompt, "from the strip");
    assert.equal(q.beats[0].prompt, card.prompt);
    q = writeMotionCardToBeat1(q, { ...card, prompt: "from the form again" });
    assert.equal(q.beats[0].prompt, "from the form again");
    assert.equal(q.beats.length, 1);
    assert.equal(beatPromptEditorForIndex(0).mainForm, true);
    assert.equal(beatPromptEditorForIndex(0).filmstripTextarea, false);
    assert.equal(beatPromptEditorForIndex(0).detailPanel, false);
    assert.equal(beatPromptEditorForIndex(1).mainForm, false);
    assert.equal(beatPromptEditorForIndex(1).filmstripTextarea, true);
    assert.equal(beatPromptEditorForIndex(1).detailPanel, true);
  });

  it("preserves trailing spaces when the motion form writes Beat 1", () => {
    const q = writeMotionCardToBeat1(emptyBeatQueue(), {
      ...emptyMotionCard(),
      prompt: "she ",
      source_image_url: STILL,
    });
    assert.equal(q.beats[0].prompt, "she ");
    const again = writeMotionCardToBeat1(q, {
      ...emptyMotionCard(),
      prompt: "she walks ",
      source_image_url: STILL,
    });
    assert.equal(again.beats[0].prompt, "she walks ");
    assert.equal(again.beats[0].id, q.beats[0].id);
  });

  it("copies Beat 1 (or the selection) as a new draft without the clip", () => {
    let q = writeMotionCardToBeat1(emptyBeatQueue(), {
      ...emptyMotionCard(),
      prompt: "beat one",
      source_image_url: STILL,
      slow_mo: true,
    });
    q = applyLocalBeatPatch(q, q.beats[0].id, { status: "approved", job_id: "child1" });
    const copy = copyBeatAsNewDraft(q.beats[0]);
    assert.notEqual(copy.id, q.beats[0].id);
    assert.equal(copy.prompt, "beat one");
    assert.equal(copy.source_image_url, STILL);
    assert.equal(copy.slow_mo, true);
    assert.equal(copy.status, "draft");
    assert.equal(copy.job_id, "");
  });

  it("does not present two independent Beat 1 prompt textareas in the studio UI", () => {
    const studio = readFileSync(join(root, "app/generate/generate-studio.tsx"), "utf8");
    const beatsUi = readFileSync(join(root, "app/generate/beat-queue.tsx"), "utf8");
    assert.match(studio, /writeMotionCardToBeat1/);
    assert.match(studio, /motionCardFromBeat1/);
    assert.match(studio, /data-testid="beat-1-prompt"/);
    assert.match(studio, /generateBeatClip/);
    assert.match(studio, /Copy Beat/);
    assert.doesNotMatch(studio, /async function goMotion\(\)[\s\S]*kind: "motion", card: motionCard, start: !dryRun/);
    assert.match(beatsUi, /i === 0/);
    assert.match(beatsUi, /beatPromptEditorForIndex/);
    assert.match(beatsUi, /Prompt & stills above/);
    assert.match(beatsUi, /selectedIndex > 0/);
    assert.doesNotMatch(beatsUi, /Add current card/);
  });

  it("Motion 2 resumes in-flight children; Motion 1 still uses pollModalJob", () => {
    const studio = readFileSync(join(root, "app/generate/generate-studio.tsx"), "utf8");
    const longformUi = readFileSync(join(root, "app/generate/longform-queue.tsx"), "utf8");
    assert.match(studio, /waitForLongformChild/);
    assert.match(studio, /resumeMotion2InFlight/);
    assert.match(studio, /bindLongformQueueToJobs/);
    assert.match(studio, /visibilitychange/);
    assert.match(studio, /motion2PrimaryBusy/);
    assert.match(studio, /already_running/);
    assert.match(studio, /async function generateBeatClip[\s\S]*pollModalJob\(j\.child\.id\)/);
    assert.match(studio, /async function goMotion\(/);
    assert.doesNotMatch(studio, /async function generateBeatClip[\s\S]*waitForLongformChild/);
    assert.match(longformUi, /inFlightLongformBeats/);
    assert.match(longformUi, /Generating…/);
    assert.match(longformUi, /data-testid="motion2-stage"/);
  });
});
