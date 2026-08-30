/**
 * lib/vater/script-chat.ts — Talk to Claude on the Review script step.
 *
 * Isomorphic: the Review UI quotes from this file, and talk-script bills
 * from the same numbers. Quote counts the FULL prompt that will be sent
 * (system + rules + current script + capped history + new message), not
 * just the new sentence. Customer price = quoteScriptUsage (tokens × 1.30,
 * ceil to the cent, 5¢ floor; empty 0+0 stays $0).
 */
import {
  estimateTokensFromText,
  expectedOutputTokens,
  quoteScriptUsage,
  type ScriptFidelity,
  type ScriptQuote,
  type ScriptWriterModelId,
} from "./script-writer-models";
import {
  FIDELITY_INSTRUCTIONS,
  SCRIPT_WRITER_FALLBACK_RULES,
} from "./script-writer-copy";

const MAX_SCRIPT_CHARS = 120_000;
const MAX_MESSAGE_CHARS = 8_000;
/** Keep the last N turns (user+assistant each count). Oldest drop first. */
export const SCRIPT_CHAT_HISTORY_CAP = 8;
/** History char budget so a long thread cannot silently blow the bill. */
export const SCRIPT_CHAT_HISTORY_CHARS = 12_000;

export const SCRIPT_CHAT_REPLY_MARK = "---REPLY---";
export const SCRIPT_CHAT_SCRIPT_MARK = "---SCRIPT---";

export interface ScriptChatTurn {
  role: "user" | "assistant";
  text: string;
  at: string;
  model?: ScriptWriterModelId;
  quotedCents?: number;
  billedCents?: number;
  usageId?: string | null;
  /** True when this assistant turn included a full revised narration. */
  revised?: boolean;
}

export interface ScriptChatCharge {
  at: string;
  model: ScriptWriterModelId;
  apiId: string;
  fidelity: ScriptFidelity;
  quotedCents: number;
  billedCents: number;
  providerCostCents: number;
  inputTokens: number;
  outputTokens: number;
  usageId?: string | null;
  revised: boolean;
}

export interface ScriptChatState {
  turns: ScriptChatTurn[];
  lastCharge: ScriptChatCharge | null;
}

function wordsIn(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

export function parseScriptChatTurns(value: unknown): ScriptChatTurn[] {
  if (!Array.isArray(value)) return [];
  const out: ScriptChatTurn[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const v = raw as Record<string, unknown>;
    if (v.role !== "user" && v.role !== "assistant") continue;
    if (typeof v.text !== "string" || !v.text.trim()) continue;
    out.push({
      role: v.role,
      text: v.text,
      at: typeof v.at === "string" ? v.at : "",
      model: typeof v.model === "string" ? (v.model as ScriptWriterModelId) : undefined,
      quotedCents: typeof v.quotedCents === "number" ? v.quotedCents : undefined,
      billedCents: typeof v.billedCents === "number" ? v.billedCents : undefined,
      usageId: typeof v.usageId === "string" ? v.usageId : null,
      revised: v.revised === true,
    });
  }
  return out;
}

export function parseScriptChatCharge(value: unknown): ScriptChatCharge | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  if (typeof v.model !== "string" || typeof v.billedCents !== "number") return null;
  return {
    at: typeof v.at === "string" ? v.at : "",
    model: v.model as ScriptWriterModelId,
    apiId: typeof v.apiId === "string" ? v.apiId : "",
    fidelity: (typeof v.fidelity === "string" ? v.fidelity : "balanced") as ScriptFidelity,
    quotedCents: Number(v.quotedCents) || 0,
    billedCents: Math.max(0, Math.round(v.billedCents)),
    providerCostCents: Number(v.providerCostCents) || 0,
    inputTokens: Number(v.inputTokens) || 0,
    outputTokens: Number(v.outputTokens) || 0,
    usageId: typeof v.usageId === "string" ? v.usageId : null,
    revised: v.revised === true,
  };
}

/** `scriptMeta.chat` bag — turns + last talk charge. */
export function readScriptChatState(scriptMeta: unknown): ScriptChatState {
  if (!scriptMeta || typeof scriptMeta !== "object" || Array.isArray(scriptMeta)) {
    return { turns: [], lastCharge: null };
  }
  const bag = scriptMeta as Record<string, unknown>;
  const chat =
    bag.chat && typeof bag.chat === "object" && !Array.isArray(bag.chat)
      ? (bag.chat as Record<string, unknown>)
      : bag;
  return {
    turns: parseScriptChatTurns(chat.turns),
    lastCharge: parseScriptChatCharge(chat.lastCharge),
  };
}

/**
 * Drop oldest turns until we are under the turn and char caps. The new
 * customer message is never dropped — it is not part of `turns`.
 */
export function capScriptChatHistory(turns: ScriptChatTurn[]): ScriptChatTurn[] {
  let kept = turns.slice(-SCRIPT_CHAT_HISTORY_CAP);
  let chars = kept.reduce((n, t) => n + t.text.length, 0);
  while (kept.length > 0 && chars > SCRIPT_CHAT_HISTORY_CHARS) {
    const dropped = kept.shift();
    chars -= dropped?.text.length ?? 0;
  }
  return kept;
}

const REWRITE_HINT =
  /\b(rewrit|revis|chang|make it|shorten|tighten|expand|replac|new hook|different|cut |add |open(ing)?|clos(e|ing))\b/i;

export function looksLikeRewriteRequest(message: string): boolean {
  return REWRITE_HINT.test(message);
}

/** A SCRIPT block is a full narration only when it is long enough to replace the box. */
export function looksLikeFullScript(candidate: string, currentScript: string): boolean {
  const words = wordsIn(candidate);
  if (words < 20) return false;
  const current = wordsIn(currentScript);
  if (current >= 40 && words < Math.max(20, Math.floor(current * 0.4))) return false;
  return true;
}

export function buildScriptChatPrompt(opts: {
  script: string;
  message: string;
  history: ScriptChatTurn[];
  fidelity: ScriptFidelity;
  title?: string | null;
  rules: string;
}): { system: string; messages: Array<{ role: "user" | "assistant"; content: string }> } {
  const script = opts.script.trim().slice(0, MAX_SCRIPT_CHARS);
  const message = opts.message.trim().slice(0, MAX_MESSAGE_CHARS);
  const history = capScriptChatHistory(opts.history);
  const system = [
    "You are talking with the customer about the CURRENT narration script in their editor.",
    "Apply the Script Rules. Hold the facts. Write in the speaker's voice.",
    `Differencing: ${FIDELITY_INSTRUCTIONS[opts.fidelity]}`,
    "",
    "Always reply in this exact shape:",
    `${SCRIPT_CHAT_REPLY_MARK}`,
    "Your notes, questions, or explanation for the customer. Never mention pricing, markup, or token rates.",
    "",
    `If — and only if — you rewrote the narration, add a second block with the COMPLETE revised script (no title, no headings):`,
    `${SCRIPT_CHAT_SCRIPT_MARK}`,
    "full spoken narration",
    "If you are only answering a question or giving notes, omit the SCRIPT block. Chat-only answers must not overwrite their editor.",
    "",
    "Script Rules:",
    opts.rules.trim() || SCRIPT_WRITER_FALLBACK_RULES,
    "",
    opts.title?.trim() ? `Working title: ${opts.title.trim()}` : null,
    "CURRENT SCRIPT:",
    script || "(empty)",
  ]
    .filter((line) => line !== null)
    .join("\n");

  const messages: Array<{ role: "user" | "assistant"; content: string }> = [];
  for (const turn of history) {
    messages.push({ role: turn.role, content: turn.text });
  }
  messages.push({
    role: "user",
    content: `The current script is in the system prompt. Customer message:\n${message}`,
  });
  return { system, messages };
}

/**
 * Quote the talk turn from the FULL prompt that will be sent.
 * Output is a modest reply, or a full-script-sized estimate when the
 * customer is asking for a rewrite — billed actuals still win after.
 */
export function quoteScriptChat(opts: {
  model: ScriptWriterModelId;
  script: string;
  message: string;
  history: ScriptChatTurn[];
  fidelity: ScriptFidelity;
  title?: string | null;
  rules: string;
}): ScriptQuote {
  const prompt = buildScriptChatPrompt(opts);
  const historyText = prompt.messages.map((m) => m.content).join("\n");
  const inputTokens =
    estimateTokensFromText(prompt.system) + estimateTokensFromText(historyText);
  const scriptWords = wordsIn(opts.script);
  const rewrite = looksLikeRewriteRequest(opts.message);
  const outputTokens = rewrite
    ? Math.max(400, expectedOutputTokens(Math.max(80, scriptWords)))
    : Math.max(200, estimateTokensFromText(opts.message) + 350);
  return quoteScriptUsage(opts.model, inputTokens, outputTokens);
}

export function parseScriptChatReply(
  raw: string,
  currentScript: string,
): { reply: string; revisedScript: string | null } {
  const text = raw.trim();
  if (!text) return { reply: "", revisedScript: null };

  const replyIdx = text.indexOf(SCRIPT_CHAT_REPLY_MARK);
  const scriptIdx = text.indexOf(SCRIPT_CHAT_SCRIPT_MARK);

  let reply = text;
  let scriptBlock: string | null = null;

  if (replyIdx >= 0) {
    const afterReply = text.slice(replyIdx + SCRIPT_CHAT_REPLY_MARK.length);
    if (scriptIdx > replyIdx) {
      reply = afterReply.slice(0, scriptIdx - (replyIdx + SCRIPT_CHAT_REPLY_MARK.length)).trim();
      scriptBlock = text.slice(scriptIdx + SCRIPT_CHAT_SCRIPT_MARK.length).trim();
    } else {
      reply = afterReply.trim();
    }
  } else if (scriptIdx >= 0) {
    reply = text.slice(0, scriptIdx).trim();
    scriptBlock = text.slice(scriptIdx + SCRIPT_CHAT_SCRIPT_MARK.length).trim();
  }

  const revised =
    scriptBlock && looksLikeFullScript(scriptBlock, currentScript) ? scriptBlock : null;
  return { reply: reply.trim(), revisedScript: revised };
}
