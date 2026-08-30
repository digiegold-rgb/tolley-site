/**
 * lib/vater/script-writer-run.ts — Claude call + empty-script handling.
 * No prisma / auth imports so unit tests can run this without the server graph.
 *
 * The Create Video Writing step used to kick the DGX (`startRunCreation`)
 * and wait. Jared: do not wait for the Spark. This module calls Anthropic
 * from the site, injects the customer's Script Rules, and returns the
 * actual token usage so billing can charge provider cost + 30%.
 *
 * Fable 5 / Opus 5 / Sonnet 5 use adaptive thinking (always on). Default
 * effort is `high`, which can spend the entire `max_tokens` budget on
 * thinking and return zero `text` blocks (`stop_reason: max_tokens`).
 * Narration scripts send `output_config.effort: "low"` and a max_tokens
 * that fits thinking + script. Thinking is never used as the video script.
 * Nothing is billed until a real text script lands (the route calls
 * recordUsage after this function returns).
 */
import Anthropic from "@anthropic-ai/sdk";
import {
  SCRIPT_WRITER_MODELS,
  estimateTokensFromText,
  quoteScriptUsage,
  type ScriptFidelity,
  type ScriptQuote,
  type ScriptWriterModelId,
  type ScriptWriterSource,
} from "./script-writer-models";
import { FIDELITY_INSTRUCTIONS, SCRIPT_WRITER_FALLBACK_RULES } from "./script-writer-copy";
import { buildScriptChatPrompt, parseScriptChatReply, type ScriptChatTurn } from "./script-chat";

const MAX_SOURCE_CHARS = 120_000;

/** Fable max output is 128k; stay well under that and the Vercel 60s cap. */
const FIRST_ATTEMPT_CAP = 32_000;
const RETRY_ATTEMPT_CAP = 48_000;
const FIRST_THINKING_CUSHION = 12_000;
const RETRY_THINKING_CUSHION = 28_000;

const EMPTY_SCRIPT_MESSAGE =
  "The writer returned an empty script. Try again or switch model.";
const EMPTY_CHAT_MESSAGE =
  "Claude returned an empty reply. Nothing was billed.";
const REFUSAL_MESSAGE =
  "The writer declined this request. Try a different source or switch model.";

export { FIDELITY_INSTRUCTIONS, SCRIPT_WRITER_FALLBACK_RULES } from "./script-writer-copy";

export type ScriptWriterEffort = "low" | "medium";

export type ScriptWriterContentBlock = { type: string; text?: string };

export interface ScriptWriterMessage {
  content: ScriptWriterContentBlock[];
  stop_reason: string | null;
  usage?: { input_tokens?: number; output_tokens?: number } | null;
}

export type ScriptWriterCreate = (
  body: Anthropic.MessageCreateParamsNonStreaming,
) => Promise<ScriptWriterMessage>;

export class ScriptWriterError extends Error {
  readonly stopReason: string | null;
  readonly detail: string;
  readonly blockTypes: string[];
  readonly inputTokens: number;
  readonly outputTokens: number;

  constructor(
    message: string,
    info: {
      stopReason?: string | null;
      blockTypes?: string[];
      inputTokens?: number;
      outputTokens?: number;
      attempt?: number;
    } = {},
  ) {
    const stopReason = info.stopReason ?? null;
    const blockTypes = info.blockTypes ?? [];
    const inputTokens = info.inputTokens ?? 0;
    const outputTokens = info.outputTokens ?? 0;
    const attempt = info.attempt ?? 1;
    const detail =
      `stop_reason=${stopReason ?? "none"} ` +
      `blocks=${blockTypes.join(",") || "none"} ` +
      `tokens=${inputTokens}+${outputTokens} ` +
      `attempt=${attempt}`;
    super(message);
    this.name = "ScriptWriterError";
    this.stopReason = stopReason;
    this.detail = detail;
    this.blockTypes = blockTypes;
    this.inputTokens = inputTokens;
    this.outputTokens = outputTokens;
  }
}

export function apiIdForModel(id: ScriptWriterModelId): string {
  const envKey =
    id === "fable"
      ? process.env.ANTHROPIC_FABLE_MODEL
      : id === "opus"
        ? process.env.ANTHROPIC_OPUS_MODEL
        : process.env.ANTHROPIC_SONNET_MODEL || process.env.ANTHROPIC_MODEL;
  const trimmed = envKey?.trim();
  return trimmed || SCRIPT_WRITER_MODELS[id].apiId;
}

export function buildScriptWriterPrompt(opts: {
  source: string;
  sourceKind: ScriptWriterSource;
  fidelity: ScriptFidelity;
  targetWordCount: number;
  title?: string | null;
  rules: string;
}): { system: string; user: string } {
  const source = opts.source.trim().slice(0, MAX_SOURCE_CHARS);
  const words = Math.max(80, Math.round(opts.targetWordCount) || 400);
  const kind =
    opts.sourceKind === "edited"
      ? "This is the customer's current draft. Write the NEXT script from this text — not only from an earlier transcript."
      : "This is the source transcript (or caption track). Write the narration script from it.";
  const system = [
    "You write spoken narration scripts for Jelly Studio videos.",
    "Return ONLY the script text — no title, no headings, no markdown fences, no preamble.",
    "Write in the speaker's voice. Apply the Script Rules below. Hold the word count.",
    "",
    `Differencing: ${FIDELITY_INSTRUCTIONS[opts.fidelity]}`,
    "",
    "Script Rules:",
    opts.rules.trim() || SCRIPT_WRITER_FALLBACK_RULES,
  ].join("\n");
  const title = opts.title?.trim();
  const user = [
    title ? `Working title: ${title}` : null,
    `Target length: about ${words} words.`,
    kind,
    "",
    source,
  ]
    .filter(Boolean)
    .join("\n");
  return { system, user };
}

/** Quote from published rates × expected size (system + source in, target out). */
export function quoteScriptJob(opts: {
  model: ScriptWriterModelId;
  source: string;
  sourceKind: ScriptWriterSource;
  fidelity: ScriptFidelity;
  targetWordCount: number;
  title?: string | null;
  rules: string;
}): ScriptQuote {
  const prompt = buildScriptWriterPrompt(opts);
  const inputTokens =
    estimateTokensFromText(prompt.system) + estimateTokensFromText(prompt.user);
  const outputTokens = Math.max(1, Math.ceil(Math.max(80, opts.targetWordCount) * 1.3));
  return quoteScriptUsage(opts.model, inputTokens, outputTokens);
}

/** Script-out tokens + a thinking cushion. Attempt 2 is the max_tokens retry. */
export function scriptWriterMaxTokens(targetWordCount: number, attempt: 1 | 2 = 1): number {
  const scriptOut = Math.max(1_200, Math.ceil(Math.max(80, targetWordCount) * 2.2));
  const cushion = attempt === 1 ? FIRST_THINKING_CUSHION : RETRY_THINKING_CUSHION;
  const cap = attempt === 1 ? FIRST_ATTEMPT_CAP : RETRY_ATTEMPT_CAP;
  return Math.min(cap, scriptOut + cushion);
}

export function scriptWriterEffort(attempt: 1 | 2 = 1): ScriptWriterEffort {
  return attempt === 1 ? "low" : "low";
}

/** Only `type === "text"` is the script. Thinking / refusal blocks stay out. */
export function scriptTextFromBlocks(content: readonly ScriptWriterContentBlock[]): string {
  return content
    .filter((b): b is ScriptWriterContentBlock & { text: string } => b.type === "text" && typeof b.text === "string")
    .map((b) => b.text)
    .join("\n")
    .trim();
}

export function writerBlockTypes(content: readonly ScriptWriterContentBlock[]): string[] {
  return content.map((b) => b.type);
}

export function isWriterRefusal(
  stopReason: string | null | undefined,
  content: readonly ScriptWriterContentBlock[],
): boolean {
  if (stopReason === "refusal") return true;
  return content.some((b) => b.type === "refusal");
}

export function shouldRetryEmptyScript(
  stopReason: string | null | undefined,
  script: string,
  attempt: number,
): boolean {
  return attempt === 1 && !script && stopReason === "max_tokens";
}

export interface GeneratedScript {
  script: string;
  model: ScriptWriterModelId;
  apiId: string;
  inputTokens: number;
  outputTokens: number;
  actual: ScriptQuote;
}

export async function generateScriptWithClaude(
  opts: {
    model: ScriptWriterModelId;
    source: string;
    sourceKind: ScriptWriterSource;
    fidelity: ScriptFidelity;
    targetWordCount: number;
    title?: string | null;
    rules: string;
  },
  deps?: { createMessage?: ScriptWriterCreate },
): Promise<GeneratedScript> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey && !deps?.createMessage) {
    throw new Error("Script writer is not configured (missing ANTHROPIC_API_KEY).");
  }
  const apiId = apiIdForModel(opts.model);
  const prompt = buildScriptWriterPrompt(opts);
  const create: ScriptWriterCreate =
    deps?.createMessage ??
    (async (body) => {
      const client = new Anthropic({ apiKey: apiKey! });
      return client.messages.create(body);
    });

  let lastEmpty: {
    stopReason: string | null;
    blockTypes: string[];
    inputTokens: number;
    outputTokens: number;
    attempt: 1 | 2;
  } | null = null;

  for (const attempt of [1, 2] as const) {
    const maxTokens = scriptWriterMaxTokens(opts.targetWordCount, attempt);
    const effort = scriptWriterEffort(attempt);
    const response = await create({
      model: apiId,
      max_tokens: maxTokens,
      system: prompt.system,
      messages: [{ role: "user", content: prompt.user }],
      // Adaptive thinking is always-on for Fable/Opus/Sonnet 5. Do NOT send
      // deprecated thinking.budget_tokens — Sonnet 5 400s that.
      thinking: { type: "adaptive" },
      output_config: { effort },
    });
    const script = scriptTextFromBlocks(response.content);
    const stopReason = response.stop_reason ?? null;
    const blockTypes = writerBlockTypes(response.content);
    const inputTokens = response.usage?.input_tokens ?? 0;
    const outputTokens = response.usage?.output_tokens ?? 0;

    if (script) {
      if (inputTokens + outputTokens <= 0) {
        throw new Error("The writer did not report token usage — nothing was billed.");
      }
      return {
        script,
        model: opts.model,
        apiId,
        inputTokens,
        outputTokens,
        actual: quoteScriptUsage(opts.model, inputTokens, outputTokens),
      };
    }

    lastEmpty = { stopReason, blockTypes, inputTokens, outputTokens, attempt };
    console.error("[script-writer] empty response", {
      apiId,
      model: opts.model,
      stop_reason: stopReason,
      blockTypes,
      inputTokens,
      outputTokens,
      attempt,
      maxTokens,
      effort,
    });

    if (isWriterRefusal(stopReason, response.content)) {
      throw new ScriptWriterError(REFUSAL_MESSAGE, lastEmpty);
    }
    if (!shouldRetryEmptyScript(stopReason, script, attempt)) {
      throw new ScriptWriterError(EMPTY_SCRIPT_MESSAGE, lastEmpty);
    }
  }

  throw new ScriptWriterError(EMPTY_SCRIPT_MESSAGE, lastEmpty ?? {});
}

export interface TalkedScript {
  reply: string;
  revisedScript: string | null;
  model: ScriptWriterModelId;
  apiId: string;
  inputTokens: number;
  outputTokens: number;
  actual: ScriptQuote;
}

/**
 * Talk turn — same effort:low + adaptive thinking + empty-text retry as
 * generate, so Fable does not spend max_tokens on thinking. Bills only
 * after a real text reply lands (the route calls recordUsage after this).
 */
export async function talkScriptWithClaude(
  opts: {
    model: ScriptWriterModelId;
    script: string;
    message: string;
    history: ScriptChatTurn[];
    fidelity: ScriptFidelity;
    title?: string | null;
    rules: string;
  },
  deps?: { createMessage?: ScriptWriterCreate },
): Promise<TalkedScript> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey && !deps?.createMessage) {
    throw new Error("Script writer is not configured (missing ANTHROPIC_API_KEY).");
  }
  const apiId = apiIdForModel(opts.model);
  const prompt = buildScriptChatPrompt(opts);
  const create: ScriptWriterCreate =
    deps?.createMessage ??
    (async (body) => {
      const client = new Anthropic({ apiKey: apiKey! });
      return client.messages.create(body);
    });

  const targetWords = Math.max(80, opts.script.trim().split(/\s+/).filter(Boolean).length);
  let lastEmpty: {
    stopReason: string | null;
    blockTypes: string[];
    inputTokens: number;
    outputTokens: number;
    attempt: 1 | 2;
  } | null = null;

  for (const attempt of [1, 2] as const) {
    const maxTokens = scriptWriterMaxTokens(targetWords, attempt);
    const effort = scriptWriterEffort(attempt);
    const response = await create({
      model: apiId,
      max_tokens: maxTokens,
      system: prompt.system,
      messages: prompt.messages.map((m) => ({ role: m.role, content: m.content })),
      thinking: { type: "adaptive" },
      output_config: { effort },
    });
    const raw = scriptTextFromBlocks(response.content);
    const stopReason = response.stop_reason ?? null;
    const blockTypes = writerBlockTypes(response.content);
    const inputTokens = response.usage?.input_tokens ?? 0;
    const outputTokens = response.usage?.output_tokens ?? 0;
    const parsed = parseScriptChatReply(raw, opts.script);

    if (parsed.reply) {
      if (inputTokens + outputTokens <= 0) {
        throw new Error("The writer did not report token usage — nothing was billed.");
      }
      return {
        reply: parsed.reply,
        revisedScript: parsed.revisedScript,
        model: opts.model,
        apiId,
        inputTokens,
        outputTokens,
        actual: quoteScriptUsage(opts.model, inputTokens, outputTokens),
      };
    }

    lastEmpty = { stopReason, blockTypes, inputTokens, outputTokens, attempt };
    console.error("[script-chat] empty response", {
      apiId,
      model: opts.model,
      stop_reason: stopReason,
      blockTypes,
      inputTokens,
      outputTokens,
      attempt,
      maxTokens,
      effort,
    });

    if (isWriterRefusal(stopReason, response.content)) {
      throw new ScriptWriterError(REFUSAL_MESSAGE, lastEmpty);
    }
    if (!shouldRetryEmptyScript(stopReason, raw, attempt)) {
      throw new ScriptWriterError(EMPTY_CHAT_MESSAGE, lastEmpty);
    }
  }

  throw new ScriptWriterError(EMPTY_CHAT_MESSAGE, lastEmpty ?? {});
}
