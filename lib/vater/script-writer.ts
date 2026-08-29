/**
 * lib/vater/script-writer.ts — on-site Claude script generation.
 *
 * The Create Video Writing step used to kick the DGX (`startRunCreation`)
 * and wait. Jared: do not wait for the Spark. This module calls Anthropic
 * from the site, injects the customer's Script Rules, and returns the
 * actual token usage so billing can charge provider cost + 30%.
 */
import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
import { isVaterStudioEmail } from "@/lib/admin-auth";
import {
  SCRIPT_WRITER_MODELS,
  estimateTokensFromText,
  quoteScriptUsage,
  type ScriptFidelity,
  type ScriptQuote,
  type ScriptWriterModelId,
  type ScriptWriterSource,
} from "./script-writer-models";

const MAX_SOURCE_CHARS = 120_000;
const MAX_RULES_CHARS = 24_000;

const FIDELITY_INSTRUCTIONS: Record<ScriptFidelity, string> = {
  faithful:
    "Stay close to the source. Keep the same claims, order, examples and names. Tighten and structure for spoken narration. Do not invent new stories, facts, or examples.",
  balanced:
    "Restructure in the speaker's voice. Keep every material fact and claim. You may reorder, tighten, and cut repetition. Do not invent new facts.",
  rewrite:
    "Write a genuinely new script from the same facts. Different hook, different examples and a different order. Facts, claims and numbers stay true to the source. Never a copy.",
};

const FALLBACK_RULES = `Genuine rewrite, not a rephrase. Before finalizing, change the opening, any named comparison structure, illustrative examples, numbered lists, and the closing line. Self-check for any three-to-eight-word phrase that could drop into the source unchanged, and fully rewrite those sentences.
The script says what the source said, in the speaker's voice, ready to read aloud.`;

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

export async function loadScriptRulesForUser(
  userId: string,
  email: string | null | undefined,
): Promise<string> {
  try {
    const studio = isVaterStudioEmail(email);
    const rules = await prisma.vaterRule.findMany({
      where: {
        kind: "script",
        retiredAt: null,
        OR: studio
          ? [{ scope: { in: ["global", "house"] } }, { scope: "owner", ownerId: userId }]
          : [{ scope: "global" }, { scope: "owner", ownerId: userId }],
      },
      orderBy: [{ section: "asc" }, { number: "asc" }],
      select: { code: true, title: true, body: true },
      take: 80,
    });
    if (rules.length === 0) return FALLBACK_RULES;
    const text = rules
      .map((r) => {
        const body = (r.body || "").trim();
        return body ? `${r.code} — ${r.title}\n${body}` : `${r.code} — ${r.title}`;
      })
      .join("\n\n");
    return text.slice(0, MAX_RULES_CHARS);
  } catch (err) {
    console.error("[script-writer] rule load failed; using fallback pack", err);
    return FALLBACK_RULES;
  }
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
    opts.rules.trim() || FALLBACK_RULES,
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

export interface GeneratedScript {
  script: string;
  model: ScriptWriterModelId;
  apiId: string;
  inputTokens: number;
  outputTokens: number;
  actual: ScriptQuote;
}

export async function generateScriptWithClaude(opts: {
  model: ScriptWriterModelId;
  source: string;
  sourceKind: ScriptWriterSource;
  fidelity: ScriptFidelity;
  targetWordCount: number;
  title?: string | null;
  rules: string;
}): Promise<GeneratedScript> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("Script writer is not configured (missing ANTHROPIC_API_KEY).");
  }
  const apiId = apiIdForModel(opts.model);
  const prompt = buildScriptWriterPrompt(opts);
  const maxTokens = Math.min(16_000, Math.max(1_200, Math.ceil(opts.targetWordCount * 2.2)));
  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model: apiId,
    max_tokens: maxTokens,
    system: prompt.system,
    messages: [{ role: "user", content: prompt.user }],
  });
  const script = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
  if (!script) {
    throw new Error("The writer returned an empty script. Try again or switch model.");
  }
  const inputTokens = response.usage?.input_tokens ?? 0;
  const outputTokens = response.usage?.output_tokens ?? 0;
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
