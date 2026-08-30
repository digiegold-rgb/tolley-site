import test from "node:test";
import assert from "node:assert/strict";
import {
  SCRIPT_WRITER_MAX_DURATION_MS,
  SCRIPT_WRITER_TIMEOUT_MESSAGE,
  canAffordEmptyScriptRetry,
  isAbortError,
  messageForScriptWriterFailure,
} from "./script-writer-timeout";

test("504 and abort map to the unpaid human line, not HTTP 504", () => {
  assert.equal(
    messageForScriptWriterFailure({ status: 504, message: "HTTP 504" }, "fallback"),
    SCRIPT_WRITER_TIMEOUT_MESSAGE,
  );
  assert.equal(
    messageForScriptWriterFailure(new Error("HTTP 504"), "fallback"),
    SCRIPT_WRITER_TIMEOUT_MESSAGE,
  );
  const abort = new Error("The user aborted a request.");
  abort.name = "AbortError";
  assert.equal(isAbortError(abort), true);
  assert.equal(messageForScriptWriterFailure(abort, "fallback"), SCRIPT_WRITER_TIMEOUT_MESSAGE);
  assert.equal(messageForScriptWriterFailure(new Error("The writer declined this request."), "fallback"), "The writer declined this request.");
  assert.match(SCRIPT_WRITER_TIMEOUT_MESSAGE, /nothing was billed/i);
  assert.doesNotMatch(SCRIPT_WRITER_TIMEOUT_MESSAGE, /HTTP 504/);
});

test("empty-script retry is skipped when remaining time would 504 again", () => {
  assert.equal(canAffordEmptyScriptRetry(55_000, 60_000), false);
  assert.equal(canAffordEmptyScriptRetry(200_000, SCRIPT_WRITER_MAX_DURATION_MS), false);
  assert.equal(canAffordEmptyScriptRetry(70_000, SCRIPT_WRITER_MAX_DURATION_MS), true);
  assert.equal(canAffordEmptyScriptRetry(1_000, SCRIPT_WRITER_MAX_DURATION_MS), true);
});
