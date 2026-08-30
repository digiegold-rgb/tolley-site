import test from "node:test";
import assert from "node:assert/strict";
import {
  SCRIPT_CHAT_HISTORY_CAP,
  SCRIPT_CHAT_REPLY_MARK,
  SCRIPT_CHAT_SCRIPT_MARK,
  buildScriptChatPrompt,
  capScriptChatHistory,
  looksLikeFullScript,
  looksLikeRewriteRequest,
  parseScriptChatReply,
  quoteScriptChat,
  readScriptChatState,
  type ScriptChatTurn,
} from "./script-chat";
import { SCRIPT_WRITER_FALLBACK_RULES } from "./script-writer-copy";
import { quoteScriptUsage } from "./script-writer-models";

const SCRIPT = Array.from({ length: 80 }, (_, i) => `Sentence number ${i + 1} about the market.`).join(" ");

function turn(role: ScriptChatTurn["role"], text: string): ScriptChatTurn {
  return { role, text, at: "2026-08-30T00:00:00.000Z" };
}

test("quote counts system + rules + script + history + new message, not just the sentence", () => {
  const short = quoteScriptChat({
    model: "sonnet",
    script: SCRIPT,
    message: "Tighten the hook.",
    history: [],
    fidelity: "balanced",
    title: "Markets",
    rules: SCRIPT_WRITER_FALLBACK_RULES,
  });
  const withHistory = quoteScriptChat({
    model: "sonnet",
    script: SCRIPT,
    message: "Tighten the hook.",
    history: [
      turn("user", "What is the opening claim?"),
      turn("assistant", "The opening claim is that rates stay high."),
    ],
    fidelity: "balanced",
    title: "Markets",
    rules: SCRIPT_WRITER_FALLBACK_RULES,
  });
  assert.ok(short.inputTokens > 80, `input ${short.inputTokens}`);
  assert.ok(withHistory.inputTokens > short.inputTokens, "history must add input tokens");
  assert.ok(short.billedCents >= 5);
  assert.equal(short.markup, 1.3);
});

test("switching models is a new quote; empty 0+0 stays $0; floor is 5¢", () => {
  const longScript = Array.from({ length: 400 }, (_, i) => `Line ${i} about rates, risk, and the close.`).join(" ");
  const sonnet = quoteScriptChat({
    model: "sonnet",
    script: longScript,
    message: "Rewrite the opening and the close.",
    history: [],
    fidelity: "rewrite",
    rules: SCRIPT_WRITER_FALLBACK_RULES,
  });
  const fable = quoteScriptChat({
    model: "fable",
    script: longScript,
    message: "Rewrite the opening and the close.",
    history: [],
    fidelity: "rewrite",
    rules: SCRIPT_WRITER_FALLBACK_RULES,
  });
  assert.ok(sonnet.billedCents >= 5);
  assert.ok(fable.billedCents > sonnet.billedCents);
  assert.equal(quoteScriptUsage("sonnet", 0, 0).billedCents, 0);
  assert.equal(quoteScriptUsage("fable", 200, 80).billedCents, 5);
});

test("history cap drops oldest turns so the billed prompt stays bounded", () => {
  const many: ScriptChatTurn[] = [];
  for (let i = 0; i < SCRIPT_CHAT_HISTORY_CAP + 6; i += 1) {
    many.push(turn(i % 2 === 0 ? "user" : "assistant", `turn ${i} ${"word ".repeat(40)}`));
  }
  const capped = capScriptChatHistory(many);
  assert.ok(capped.length <= SCRIPT_CHAT_HISTORY_CAP);
  assert.equal(capped[capped.length - 1]?.text.startsWith(`turn ${many.length - 1}`), true);
  const prompt = buildScriptChatPrompt({
    script: SCRIPT,
    message: "One more thought.",
    history: many,
    fidelity: "balanced",
    rules: SCRIPT_WRITER_FALLBACK_RULES,
  });
  assert.ok(prompt.system.includes("CURRENT SCRIPT:"));
  assert.ok(prompt.system.includes(SCRIPT_WRITER_FALLBACK_RULES.slice(0, 20)));
  assert.ok(prompt.messages.length <= SCRIPT_CHAT_HISTORY_CAP + 1);
});

test("parse offers Apply only for a full SCRIPT block, not chat notes", () => {
  const notes = parseScriptChatReply(
    `${SCRIPT_CHAT_REPLY_MARK}\nThe hook is strong. I would not change it.`,
    SCRIPT,
  );
  assert.match(notes.reply, /hook is strong/);
  assert.equal(notes.revisedScript, null);

  const revised = parseScriptChatReply(
    `${SCRIPT_CHAT_REPLY_MARK}\nTightened the open.\n${SCRIPT_CHAT_SCRIPT_MARK}\n${SCRIPT} And a new last line about risk.`,
    SCRIPT,
  );
  assert.equal(revised.reply, "Tightened the open.");
  assert.ok(revised.revisedScript);
  assert.match(revised.revisedScript!, /new last line about risk/);
  assert.equal(looksLikeFullScript("too short", SCRIPT), false);
  assert.equal(looksLikeRewriteRequest("Tighten the hook please"), true);
  assert.equal(looksLikeRewriteRequest("What does this sentence mean?"), false);
});

test("scriptMeta.chat round-trips last charge and turns", () => {
  const state = readScriptChatState({
    chat: {
      turns: [{ role: "user", text: "hello", at: "t" }],
      lastCharge: {
        at: "t",
        model: "fable",
        apiId: "claude-fable-5",
        fidelity: "balanced",
        quotedCents: 20,
        billedCents: 39,
        providerCostCents: 30,
        inputTokens: 7396,
        outputTokens: 4513,
        usageId: "usage_x",
        revised: false,
      },
    },
  });
  assert.equal(state.turns.length, 1);
  assert.equal(state.lastCharge?.billedCents, 39);
  assert.equal(state.lastCharge?.quotedCents, 20);
});
