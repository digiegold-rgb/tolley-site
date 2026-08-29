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

test("a leftover DGX scripting job still pulses on Writing", () => {
  const d = deriveCreateStep({ status: "scripting", flowStep: 4, transcript: "x" });
  assert.equal(d.step, 4);
  assert.equal(d.kind, "async");
  assert.equal(d.active, true);
});
