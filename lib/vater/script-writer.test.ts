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
  talkScriptWithClaude,
  writerBlockTypes,
} from "./script-writer-run";
import { SCRIPT_CHAT_REPLY_MARK, SCRIPT_CHAT_SCRIPT_MARK } from "./script-chat";

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
  // First attempt ate the old 60s window — do not start a second call.
  assert.equal(shouldRetryEmptyScript("max_tokens", "", 1, 55_000, 60_000), false);
  // Plenty of the 300s Pro window left after a ~70s first attempt.
  assert.equal(shouldRetryEmptyScript("max_tokens", "", 1, 70_000, 300_000), true);
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

test("talk turn uses effort:low, retries thinking-only max_tokens, and parses Apply script", async () => {
  const calls: Array<{ max_tokens: number; effort?: string }> = [];
  const talked = await talkScriptWithClaude(
    {
      model: "fable",
      script: JOB.source,
      message: "Tighten the hook.",
      history: [],
      fidelity: "balanced",
      title: "Markets",
      rules: "Speak plainly.",
    },
    {
      createMessage: async (body) => {
        const effort = body.output_config?.effort ?? undefined;
        calls.push({ max_tokens: body.max_tokens, effort: effort ?? undefined });
        assert.equal(body.thinking && "type" in body.thinking ? body.thinking.type : "", "adaptive");
        if (calls.length === 1) {
          return {
            content: [{ type: "thinking" }],
            stop_reason: "max_tokens",
            usage: { input_tokens: 400, output_tokens: 2000 },
          };
        }
        return {
          content: [
            { type: "thinking" },
            {
              type: "text",
              text:
                `${SCRIPT_CHAT_REPLY_MARK}\nTightened.\n${SCRIPT_CHAT_SCRIPT_MARK}\n` +
                `${JOB.source} A sharper open.`,
            },
          ],
          stop_reason: "end_turn",
          usage: { input_tokens: 900, output_tokens: 600 },
        };
      },
    },
  );
  assert.equal(calls.length, 2);
  assert.equal(calls[0]!.effort, "low");
  assert.equal(talked.reply, "Tightened.");
  assert.ok(talked.revisedScript);
  assert.match(talked.revisedScript!, /sharper open/);
  assert.ok(talked.actual.billedCents >= 5);
});

test("talk refusal is not billed — throws before a charge", async () => {
  await assert.rejects(
    () =>
      talkScriptWithClaude(
        {
          model: "sonnet",
          script: JOB.source,
          message: "hello",
          history: [],
          fidelity: "balanced",
          rules: "Speak plainly.",
        },
        {
          createMessage: async () => ({
            content: [{ type: "refusal" }],
            stop_reason: "refusal",
            usage: { input_tokens: 10, output_tokens: 4 },
          }),
        },
      ),
    (err: unknown) => {
      assert.ok(err instanceof ScriptWriterError);
      assert.match(err.message, /declined/);
      return true;
    },
  );
});

test("empty max_tokens does not start a second Anthropic call when the window is gone", async () => {
  const calls: number[] = [];
  let t = 0;
  await assert.rejects(
    () =>
      generateScriptWithClaude(JOB, {
        now: () => t,
        budgetMs: 60_000,
        createMessage: async () => {
          calls.push(t);
          t += 55_000;
          return {
            content: [{ type: "thinking" }],
            stop_reason: "max_tokens",
            usage: { input_tokens: 800, output_tokens: 3300 },
          };
        },
      }),
    (err: unknown) => {
      assert.ok(err instanceof ScriptWriterError);
      assert.equal(err.message, "The writer returned an empty script. Try again or switch model.");
      return true;
    },
  );
  assert.equal(calls.length, 1, "must not start a retry that would 504");
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
