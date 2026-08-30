import test from "node:test";
import assert from "node:assert/strict";
import {
  ScriptWriterError,
  generateScriptWithClaude,
  isWriterRefusal,
  scriptTextFromBlocks,
  scriptWriterEffort,
  scriptWriterMaxTokens,
  shouldRetryEmptyScript,
  writerBlockTypes,
} from "./script-writer-run";

test("max_tokens is script-out plus a thinking cushion, not the old 16k cap", () => {
  // 10-minute script (~1500 words): old formula was ~3300 and thinking ate it.
  const first = scriptWriterMaxTokens(1500, 1);
  const retry = scriptWriterMaxTokens(1500, 2);
  assert.ok(first >= 1_200 + 12_000, `first ${first}`);
  assert.ok(retry > first, `retry ${retry} should exceed first ${first}`);
  assert.ok(first <= 32_000);
  assert.ok(retry <= 48_000);
  assert.equal(scriptWriterEffort(1), "low");
  assert.equal(scriptWriterEffort(2), "low");
});

test("only type===text is the script; thinking is never dumped in", () => {
  assert.equal(
    scriptTextFromBlocks([
      { type: "thinking", text: "I will outline a hook…" },
      { type: "text", text: "  Welcome back. Today we talk markets.  " },
    ]),
    "Welcome back. Today we talk markets.",
  );
  assert.equal(scriptTextFromBlocks([{ type: "thinking" }, { type: "redacted_thinking" }]), "");
  assert.deepEqual(writerBlockTypes([{ type: "thinking" }, { type: "text", text: "hi" }]), [
    "thinking",
    "text",
  ]);
});

test("refusal is a classifier stop, not an empty script", () => {
  assert.equal(isWriterRefusal("refusal", []), true);
  assert.equal(isWriterRefusal("end_turn", [{ type: "refusal" }]), true);
  assert.equal(isWriterRefusal("max_tokens", [{ type: "thinking" }]), false);
  assert.equal(shouldRetryEmptyScript("max_tokens", "", 1), true);
  assert.equal(shouldRetryEmptyScript("max_tokens", "", 2), false);
  assert.equal(shouldRetryEmptyScript("end_turn", "", 1), false);
  assert.equal(shouldRetryEmptyScript("max_tokens", "a script", 1), false);
});

const JOB = {
  model: "fable" as const,
  source: "One two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty.",
  sourceKind: "transcript" as const,
  fidelity: "balanced" as const,
  targetWordCount: 1500,
  title: "Markets",
  rules: "Speak plainly.",
};

test("thinking-only max_tokens response retries once with more room, then returns text", async () => {
  const calls: Array<{ max_tokens: number; effort?: string }> = [];
  const script = await generateScriptWithClaude(JOB, {
    createMessage: async (body) => {
      const effort = body.output_config?.effort ?? undefined;
      calls.push({ max_tokens: body.max_tokens, effort: effort ?? undefined });
      assert.equal(body.thinking && "type" in body.thinking ? body.thinking.type : "", "adaptive");
      assert.ok(!("budget_tokens" in (body.thinking ?? {})));
      if (calls.length === 1) {
        return {
          content: [{ type: "thinking" }],
          stop_reason: "max_tokens",
          usage: { input_tokens: 800, output_tokens: 3300 },
        };
      }
      return {
        content: [
          { type: "thinking" },
          { type: "text", text: "Here is the spoken narration script." },
        ],
        stop_reason: "end_turn",
        usage: { input_tokens: 800, output_tokens: 4200 },
      };
    },
  });
  assert.equal(calls.length, 2);
  assert.equal(calls[0]!.effort, "low");
  assert.equal(calls[1]!.effort, "low");
  assert.ok(calls[1]!.max_tokens > calls[0]!.max_tokens);
  assert.equal(script.script, "Here is the spoken narration script.");
  assert.equal(script.outputTokens, 4200);
  assert.ok(script.actual.billedCents >= 5);
});

test("empty after retry throws customer empty-script with stop_reason in detail", async () => {
  await assert.rejects(
    () =>
      generateScriptWithClaude(JOB, {
        createMessage: async () => ({
          content: [{ type: "thinking" }, { type: "thinking" }],
          stop_reason: "max_tokens",
          usage: { input_tokens: 10, output_tokens: 16000 },
        }),
      }),
    (err: unknown) => {
      assert.ok(err instanceof ScriptWriterError);
      assert.equal(err.message, "The writer returned an empty script. Try again or switch model.");
      assert.match(err.detail, /stop_reason=max_tokens/);
      assert.match(err.detail, /blocks=thinking,thinking/);
      assert.match(err.detail, /tokens=10\+16000/);
      return true;
    },
  );
});

test("classifier refusal is a 502-shaped ScriptWriterError, not empty script", async () => {
  await assert.rejects(
    () =>
      generateScriptWithClaude(JOB, {
        createMessage: async () => ({
          content: [{ type: "refusal" }],
          stop_reason: "refusal",
          usage: { input_tokens: 40, output_tokens: 12 },
        }),
      }),
    (err: unknown) => {
      assert.ok(err instanceof ScriptWriterError);
      assert.equal(
        err.message,
        "The writer declined this request. Try a different source or switch model.",
      );
      assert.match(err.detail, /stop_reason=refusal/);
      return true;
    },
  );
});
