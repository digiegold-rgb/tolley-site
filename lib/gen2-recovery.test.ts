import assert from "node:assert/strict";
import { test } from "node:test";
import { generationRecovery } from "./gen2-recovery";

test("provider balance errors are not mistaken for sign-in failures", () => {
  const failure = generationRecovery("HTTP 403 — Forbidden — User is locked. Reason: Exhausted balance. Top up at fal.ai/dashboard/billing.");
  assert.equal(failure.kind, "billing");
  assert.equal(failure.billing, true);
  assert.match(failure.guidance, /Changing between those models will not clear/);
  assert.equal(generationRecovery("Access expired or needs two-factor authentication").kind, "access");
});

test("recoverable source, request and processing failures get different next steps", () => {
  assert.equal(generationRecovery("Spark still not found (404).").kind, "source");
  assert.equal(generationRecovery("HTTP 400: Bad Request").kind, "input");
  assert.equal(generationRecovery("HTTP 422 content_policy_violation").kind, "content");
  assert.equal(generationRecovery("Last-frame extract failed: spawn ffmpeg ENOENT").kind, "processing");
  assert.equal(generationRecovery("Dismiss or retry the failed beat first").kind, "queue");
  assert.equal(generationRecovery("Test provider temporarily unavailable").kind, "other");
});
