import test from "node:test";
import assert from "node:assert/strict";
import { deriveCreateStep } from "./create-steps";

test("after length, a transcribed row lands on Writing (input), not a spinner", () => {
  const d = deriveCreateStep({
    status: "transcribed",
    flowStep: 4,
    transcript: "words ".repeat(50),
    script: null,
  });
  assert.equal(d.step, 4);
  assert.equal(d.kind, "input");
  assert.equal(d.active, false);
});

test("own script and generate-from-video share Writing when flowStep is 4", () => {
  const own = deriveCreateStep({
    status: "draft",
    flowStep: 4,
    script: "A finished script the customer pasted.",
    transcript: null,
  });
  assert.equal(own.step, 4);
  assert.equal(own.kind, "input");

  const video = deriveCreateStep({
    status: "transcribed",
    flowStep: 4,
    transcript: "caption track ".repeat(40),
    script: null,
  });
  assert.equal(video.step, 4);
  assert.equal(video.kind, "input");
});

test("Review stays the approval gate once flowStep is 5 or the writer parked", () => {
  assert.equal(
    deriveCreateStep({
      status: "draft",
      flowStep: 5,
      script: "pasted",
    }).step,
    5,
  );
  const parked = deriveCreateStep({
    status: "awaiting_script_approval",
    flowStep: 5,
    script: "generated",
    approvalExpiresAt: new Date(Date.now() + 864e5),
  });
  assert.equal(parked.step, 5);
  assert.equal(parked.kind, "approval");
});

test("video path + pasted script + Continue lands on Review", () => {
  const d = deriveCreateStep({
    status: "transcribed",
    flowStep: 5,
    transcript: "caption track ".repeat(40),
    script: "Trey injected his own copy after the transcript.",
  });
  assert.equal(d.step, 5);
  assert.equal(d.kind, "approval");
});

test("patching flowStep back to 3 reopens Length on a transcribed row", () => {
  const writing = deriveCreateStep({
    status: "transcribed",
    flowStep: 4,
    transcript: "caption track ".repeat(40),
  });
  assert.equal(writing.step, 4);
  assert.equal(writing.kind, "input");

  const length = deriveCreateStep({
    status: "transcribed",
    flowStep: 3,
    transcript: "caption track ".repeat(40),
  });
  assert.equal(length.step, 3);
  assert.equal(length.kind, "input");
  assert.equal(length.active, false);
});

test("a leftover DGX scripting job still pulses on Writing", () => {
  const d = deriveCreateStep({ status: "scripting", flowStep: 4, transcript: "x" });
  assert.equal(d.step, 4);
  assert.equal(d.kind, "async");
  assert.equal(d.active, true);
});

test("produce queued after approve is Producing (step 7), not Writing", () => {
  const d = deriveCreateStep({
    status: "queued",
    scriptApprovedAt: new Date(),
    script: "approved copy",
    flowStep: 7,
  });
  assert.equal(d.step, 7);
  assert.equal(d.kind, "async");
});

test("#66 finished stitch on concierge_in_progress is Done, not Producing", () => {
  const d = deriveCreateStep({
    status: "concierge_in_progress",
    flowStep: 7,
    finalVideoUrl: "https://example.blob.vercel-storage.com/vater-finals/x.mp4",
    progress: 100,
    completedAt: "2026-08-30T14:48:11.804Z",
    stepDetails: { phase: "done", jobStatus: "done", progress: 100, jobId: "abc" },
    autopilotJobId: "abc",
  });
  assert.equal(d.step, 8);
  assert.equal(d.kind, "terminal");
  assert.equal(d.active, false);
});
