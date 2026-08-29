/**
 * lib/vater/script-writer-models.ts — Create Video script writer catalog.
 *
 * Isomorphic: the Writing / Review UI quotes from this file, and the
 * write-script route bills from the same numbers. Published Anthropic API
 * rates (platform.claude.com, checked 2026-08-29):
 *
 *   Fable 5   claude-fable-5    $10 / $50 per MTok
 *   Opus 5    claude-opus-5      $5 / $25 per MTok
 *   Sonnet 5  claude-sonnet-5    $2 / $10 per MTok
 *
 * Customer price = provider cost × 1.30, rounded up to the cent. No 25¢
 * cap and no 5× markup on this charge — quote before generate, bill the
 * actual input+output tokens the API returns.
 */

export const SCRIPT_WRITER_MARKUP = 1.3;

/** Product default. Trey (tvater326) is the only per-user override. */
export const SCRIPT_WRITER_PRODUCT_DEFAULT = "sonnet" as const;

/**
 * Trey's Animate login. Used only to default HIS picker to Fable — do not
 * invent other accounts. Last-used model still wins over this default.
 */
export const TREY_ANIMATE_EMAIL = "tvater326@gmail.com";

export const SCRIPT_WRITER_MODEL_IDS = ["fable", "opus", "sonnet"] as const;
export type ScriptWriterModelId = (typeof SCRIPT_WRITER_MODEL_IDS)[number];

export const SCRIPT_FIDELITIES = ["faithful", "balanced", "rewrite"] as const;
export type ScriptFidelity = (typeof SCRIPT_FIDELITIES)[number];

export const SCRIPT_WRITER_SOURCES = ["transcript", "edited"] as const;
export type ScriptWriterSource = (typeof SCRIPT_WRITER_SOURCES)[number];

export interface ScriptWriterModel {
  id: ScriptWriterModelId;
  /** Customer-facing name on the picker. */
  label: string;
  /** One line under the name. */
  blurb: string;
  /** Anthropic Messages API id. Overridable via env on the server. */
  apiId: string;
  /** Published USD per million input tokens. */
  inputUsdPerMTok: number;
  /** Published USD per million output tokens. */
  outputUsdPerMTok: number;
}

export const SCRIPT_WRITER_MODELS: Record<ScriptWriterModelId, ScriptWriterModel> = {
  fable: {
    id: "fable",
    label: "Fable",
    blurb: "Claude Fable 5 — strongest rewrite, highest token rate.",
    apiId: "claude-fable-5",
    inputUsdPerMTok: 10,
    outputUsdPerMTok: 50,
  },
  opus: {
    id: "opus",
    label: "Opus",
    blurb: "Claude Opus 5 — deeper pass than Sonnet.",
    apiId: "claude-opus-5",
    inputUsdPerMTok: 5,
    outputUsdPerMTok: 25,
  },
  sonnet: {
    id: "sonnet",
    label: "Sonnet",
    blurb: "Claude Sonnet 5 — the product default.",
    apiId: "claude-sonnet-5",
    inputUsdPerMTok: 2,
    outputUsdPerMTok: 10,
  },
};

export const SCRIPT_FIDELITY_LABELS: Record<ScriptFidelity, string> = {
  faithful: "Stay close to the source",
  balanced: "Restructure in your voice",
  rewrite: "Rewrite — new hook and order",
};

export const SCRIPT_FIDELITY_HINTS: Record<ScriptFidelity, string> = {
  faithful:
    "Keeps the same claims, order and examples. Tightens for narration; does not invent new stories.",
  balanced:
    "Same facts, your voice. May reorder and cut. The live default.",
  rewrite:
    "A genuinely new script from the same facts — different hook, examples and order.",
};

/** localStorage key for the last model this browser picked. */
export const SCRIPT_WRITER_MODEL_STORAGE_KEY = "jelly.scriptWriter.model";

export function isScriptWriterModelId(value: unknown): value is ScriptWriterModelId {
  return typeof value === "string" && (SCRIPT_WRITER_MODEL_IDS as readonly string[]).includes(value);
}

export function isScriptFidelity(value: unknown): value is ScriptFidelity {
  return typeof value === "string" && (SCRIPT_FIDELITIES as readonly string[]).includes(value);
}

export function isTreyAnimateEmail(email: string | null | undefined): boolean {
  return (email ?? "").trim().toLowerCase() === TREY_ANIMATE_EMAIL;
}

/** Product default Sonnet; Trey's Animate account defaults to Fable. */
export function defaultScriptWriterModel(email: string | null | undefined): ScriptWriterModelId {
  return isTreyAnimateEmail(email) ? "fable" : SCRIPT_WRITER_PRODUCT_DEFAULT;
}

export function readStoredScriptWriterModel(): ScriptWriterModelId | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SCRIPT_WRITER_MODEL_STORAGE_KEY);
    return isScriptWriterModelId(raw) ? raw : null;
  } catch {
    return null;
  }
}

export function storeScriptWriterModel(id: ScriptWriterModelId): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SCRIPT_WRITER_MODEL_STORAGE_KEY, id);
  } catch {
    /* private mode / quota — picker still works for this session */
  }
}

/** Last stored pick, else Trey→Fable / everyone else→Sonnet. */
export function resolveScriptWriterModel(email: string | null | undefined): ScriptWriterModelId {
  return readStoredScriptWriterModel() ?? defaultScriptWriterModel(email);
}

/**
 * ~1.3 tokens/word is the published English rule of thumb Anthropic uses
 * for quotes. Empty text is 0, not 1 — a missing source must not invent
 * a charge.
 */
export function estimateTokensFromText(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  if (words === 0) return 0;
  return Math.ceil(words * 1.3);
}

export function expectedOutputTokens(targetWordCount: number): number {
  const words = Math.max(0, Math.round(targetWordCount));
  if (words === 0) return 0;
  return Math.ceil(words * 1.3);
}

export interface ScriptQuote {
  model: ScriptWriterModelId;
  apiId: string;
  inputTokens: number;
  outputTokens: number;
  /** Provider $ × 100, before markup. */
  providerCostCents: number;
  /** ceil(provider × 1.30). What we show / charge. */
  billedCents: number;
  markup: typeof SCRIPT_WRITER_MARKUP;
}

function usdToCents(usd: number): number {
  if (!Number.isFinite(usd) || usd <= 0) return 0;
  return Math.ceil(usd * 100 - 1e-9);
}

/** Provider USD for a token pair, then +30% billed cents. */
export function quoteScriptUsage(
  model: ScriptWriterModelId,
  inputTokens: number,
  outputTokens: number,
): ScriptQuote {
  const spec = SCRIPT_WRITER_MODELS[model];
  const inTok = Math.max(0, Math.round(inputTokens));
  const outTok = Math.max(0, Math.round(outputTokens));
  const providerUsd =
    (inTok / 1_000_000) * spec.inputUsdPerMTok + (outTok / 1_000_000) * spec.outputUsdPerMTok;
  const providerCostCents = usdToCents(providerUsd);
  const billedCents = usdToCents(providerUsd * SCRIPT_WRITER_MARKUP);
  return {
    model,
    apiId: spec.apiId,
    inputTokens: inTok,
    outputTokens: outTok,
    providerCostCents,
    billedCents,
    markup: SCRIPT_WRITER_MARKUP,
  };
}

export interface ScriptWriterCharge {
  at: string;
  model: ScriptWriterModelId;
  apiId: string;
  source: ScriptWriterSource;
  fidelity: ScriptFidelity;
  quotedCents: number;
  billedCents: number;
  providerCostCents: number;
  inputTokens: number;
  outputTokens: number;
  markup: number;
  usageId?: string | null;
}

export function parseScriptWriterCharge(value: unknown): ScriptWriterCharge | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  if (!isScriptWriterModelId(v.model)) return null;
  if (typeof v.billedCents !== "number" || !Number.isFinite(v.billedCents)) return null;
  return {
    at: typeof v.at === "string" ? v.at : "",
    model: v.model,
    apiId: typeof v.apiId === "string" ? v.apiId : SCRIPT_WRITER_MODELS[v.model].apiId,
    source: v.source === "edited" ? "edited" : "transcript",
    fidelity: isScriptFidelity(v.fidelity) ? v.fidelity : "balanced",
    quotedCents: Number(v.quotedCents) || 0,
    billedCents: Math.max(0, Math.round(v.billedCents)),
    providerCostCents: Number(v.providerCostCents) || 0,
    inputTokens: Number(v.inputTokens) || 0,
    outputTokens: Number(v.outputTokens) || 0,
    markup: typeof v.markup === "number" ? v.markup : SCRIPT_WRITER_MARKUP,
    usageId: typeof v.usageId === "string" ? v.usageId : null,
  };
}

/** Latest on-site writer charge stored on `scriptMeta.writer`. */
export function readLastScriptCharge(scriptMeta: unknown): ScriptWriterCharge | null {
  if (!scriptMeta || typeof scriptMeta !== "object" || Array.isArray(scriptMeta)) return null;
  const bag = scriptMeta as Record<string, unknown>;
  return parseScriptWriterCharge(bag.writer) ?? parseScriptWriterCharge(scriptMeta);
}

export function formatScriptCents(cents: number): string {
  const n = Math.max(0, Math.round(cents));
  if (n === 0) return "$0.00";
  return `$${(n / 100).toFixed(2)}`;
}
