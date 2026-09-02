/**
 * OpenAI-compatible vLLM client for Qwen 3.8 Unlocked on DGX Spark.
 *
 * This is NOT the Alibaba Qwen-Max paid API and NOT Claude. It talks to a
 * local/tunneled vLLM that exposes POST {base}/chat/completions.
 *
 * Env (no secrets hardcoded):
 *   QWEN_VLLM_BASE_URL  — Spark vLLM base, e.g. http://127.0.0.1:8357/v1
 *                         or https://YOUR-SPARK-HOST/v1
 *                         (client appends /chat/completions if missing)
 *   QWEN_VLLM_MODEL     — served model id, e.g. KarlKinda/Qwen3.8-27B-Uncensored-FP8
 *   QWEN_VLLM_API_KEY   — optional Bearer token (vLLM often needs none / "none")
 *
 * See docs/generate-qwen-vllm.md for how to point this at Spark.
 */

export const QWEN_DEFAULT_MODEL = "KarlKinda/Qwen3.8-27B-Uncensored-FP8";

export interface QwenVllmConfig {
  baseUrl: string;
  completionsUrl: string;
  model: string;
  apiKey: string | null;
}

export interface QwenChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface QwenChatResult {
  text: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
}

export class QwenVllmConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QwenVllmConfigError";
  }
}

/** Normalize a base URL so we always POST to …/v1/chat/completions. */
export function qwenChatCompletionsUrl(base: string): string {
  const trimmed = base.trim().replace(/\/+$/, "");
  if (!trimmed) {
    throw new QwenVllmConfigError("QWEN_VLLM_BASE_URL is empty");
  }
  if (trimmed.endsWith("/chat/completions")) return trimmed;
  if (trimmed.endsWith("/v1")) return `${trimmed}/chat/completions`;
  return `${trimmed}/v1/chat/completions`;
}

export function readQwenVllmConfig(
  env: NodeJS.ProcessEnv = process.env,
): QwenVllmConfig {
  const raw = (env.QWEN_VLLM_BASE_URL || "").trim();
  if (!raw) {
    throw new QwenVllmConfigError(
      "QWEN_VLLM_BASE_URL is not set. Point it at Spark vLLM, e.g. http://127.0.0.1:8357/v1 — see docs/generate-qwen-vllm.md",
    );
  }
  const key = (env.QWEN_VLLM_API_KEY || "").trim();
  return {
    baseUrl: raw.replace(/\/+$/, ""),
    completionsUrl: qwenChatCompletionsUrl(raw),
    model: (env.QWEN_VLLM_MODEL || "").trim() || QWEN_DEFAULT_MODEL,
    apiKey: !key || key === "none" ? null : key,
  };
}

export function isQwenConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean((env.QWEN_VLLM_BASE_URL || "").trim());
}

export function qwenPublicStatus(env: NodeJS.ProcessEnv = process.env): {
  configured: boolean;
  model: string | null;
  provider: "qwen-vllm";
} {
  if (!isQwenConfigured(env)) {
    return { configured: false, model: null, provider: "qwen-vllm" };
  }
  try {
    const cfg = readQwenVllmConfig(env);
    return { configured: true, model: cfg.model, provider: "qwen-vllm" };
  } catch {
    return { configured: false, model: null, provider: "qwen-vllm" };
  }
}

function stripThink(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
}

export async function qwenChatCompletion(
  messages: QwenChatMessage[],
  opts?: {
    maxTokens?: number;
    temperature?: number;
    timeoutMs?: number;
    env?: NodeJS.ProcessEnv;
    fetchImpl?: typeof fetch;
  },
): Promise<QwenChatResult> {
  const cfg = readQwenVllmConfig(opts?.env);
  const doFetch = opts?.fetchImpl ?? fetch;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (cfg.apiKey) headers.Authorization = `Bearer ${cfg.apiKey}`;

  const res = await doFetch(cfg.completionsUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: cfg.model,
      messages,
      max_tokens: opts?.maxTokens ?? 2048,
      temperature: opts?.temperature ?? 0.7,
      chat_template_kwargs: { enable_thinking: false },
    }),
    signal: AbortSignal.timeout(opts?.timeoutMs ?? 90_000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Qwen vLLM ${res.status}: ${body.slice(0, 240)}`);
  }

  const data = (await res.json()) as {
    model?: string;
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  const text = stripThink(data.choices?.[0]?.message?.content || "");
  if (!text) {
    throw new Error("Empty content from Qwen vLLM");
  }
  return {
    text,
    model: data.model || cfg.model,
    promptTokens: data.usage?.prompt_tokens || 0,
    completionTokens: data.usage?.completion_tokens || 0,
  };
}
