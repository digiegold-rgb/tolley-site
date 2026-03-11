/**
 * LLM client for AI SMS responses + general use.
 *
 * Uses OpenAI-compatible API format. Works with:
 * - vLLM on DGX Spark (via Cloudflare tunnel or Tailscale)
 * - OpenAI API
 * - Anthropic (via OpenAI-compatible proxy)
 * - Any OpenAI-compatible endpoint
 *
 * Env vars:
 *   LLM_API_URL   — base URL (e.g., "https://llm.tolley.io/v1" or "https://api.openai.com/v1")
 *   LLM_API_KEY   — API key (use "none" for local vLLM)
 *   LLM_MODEL     — model name (e.g., "Qwen/Qwen3.5-35B-A3B-FP8" or "gpt-4o-mini")
 *   LLM_PROVIDER  — provider label for analytics (e.g., "vllm-local", "openai", "anthropic")
 *   LLM_LOCATION  — where the model runs (e.g., "dgx-spark", "cloud-us")
 */

import { logLlmUsage } from "@/lib/llm-usage";

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface CompletionResponse {
  text: string;
  tokensUsed: number;
  promptTokens: number;
  completionTokens: number;
  latencyMs: number;
  model: string;
  provider: string;
}

export async function chatCompletion(
  messages: ChatMessage[],
  opts?: {
    maxTokens?: number;
    temperature?: number;
    userId?: string;
    route?: string;
    type?: string;
    meta?: Record<string, unknown>;
  }
): Promise<CompletionResponse> {
  const baseUrl = process.env.LLM_API_URL;
  const apiKey = process.env.LLM_API_KEY || "none";
  const model = process.env.LLM_MODEL || "gpt-4o-mini";
  const provider = process.env.LLM_PROVIDER || detectProvider(baseUrl || "");
  const location = process.env.LLM_LOCATION || detectLocation(baseUrl || "");

  if (!baseUrl) {
    throw new Error("Missing LLM_API_URL env var");
  }

  const start = Date.now();
  let statusCode = 0;
  let errorMessage: string | undefined;
  let promptTokens = 0;
  let completionTokens = 0;
  let totalTokens = 0;
  let text = "";

  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: opts?.maxTokens ?? 300,
        temperature: opts?.temperature ?? 0.7,
      }),
      signal: AbortSignal.timeout(30_000),
    });

    statusCode = res.status;

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      errorMessage = `LLM API ${res.status}: ${body.slice(0, 200)}`;
      throw new Error(errorMessage);
    }

    const data = await res.json();
    const choice = data.choices?.[0];
    text = choice?.message?.content?.trim() || "";
    promptTokens = data.usage?.prompt_tokens || 0;
    completionTokens = data.usage?.completion_tokens || 0;
    totalTokens = data.usage?.total_tokens || (promptTokens + completionTokens);
  } catch (err) {
    if (!errorMessage) {
      errorMessage = err instanceof Error ? err.message : "unknown error";
    }
    throw err;
  } finally {
    const latencyMs = Date.now() - start;

    // Auto-log usage if userId is provided (fire-and-forget)
    if (opts?.userId) {
      logLlmUsage({
        userId: opts.userId,
        type: opts.type || "chat",
        provider,
        model,
        location,
        endpoint: baseUrl,
        route: opts.route,
        promptTokens,
        completionTokens,
        tokensApprox: totalTokens,
        latencyMs,
        statusCode,
        errorMessage,
        meta: opts.meta,
      }).catch(() => {});
    }
  }

  return {
    text,
    tokensUsed: totalTokens,
    promptTokens,
    completionTokens,
    latencyMs: Date.now() - start,
    model,
    provider,
  };
}

/** Auto-detect provider from URL */
function detectProvider(url: string): string {
  if (url.includes("127.0.0.1") || url.includes("localhost")) return "vllm-local";
  if (url.includes("openai.com")) return "openai";
  if (url.includes("anthropic.com")) return "anthropic";
  if (url.includes("groq.com")) return "groq";
  if (url.includes("together.xyz")) return "together";
  if (url.includes("fireworks.ai")) return "fireworks";
  if (url.includes("tolley.io")) return "vllm-tunnel";
  return "unknown";
}

/** Auto-detect location from URL */
function detectLocation(url: string): string {
  if (url.includes("127.0.0.1") || url.includes("localhost")) return "dgx-spark";
  if (url.includes("tolley.io")) return "dgx-spark-tunnel";
  return "cloud";
}
