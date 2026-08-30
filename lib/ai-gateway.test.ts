import test from "node:test";
import assert from "node:assert/strict";
import { anthropicModelId } from "./ai-gateway";

test("gateway model ids are anthropic/ prefixed; direct ids stay bare", () => {
  assert.equal(anthropicModelId("claude-fable-5", true), "anthropic/claude-fable-5");
  assert.equal(anthropicModelId("claude-fable-5", false), "claude-fable-5");
  assert.equal(anthropicModelId("anthropic/claude-fable-5", true), "anthropic/claude-fable-5");
});
