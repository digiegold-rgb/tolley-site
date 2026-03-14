import { prisma } from "@/lib/prisma";

/**
 * Log an LLM/AI API call. Drop this one-liner anywhere you call an AI model.
 *
 * Usage:
 *   const start = Date.now();
 *   const result = await fetch(llmEndpoint, ...);
 *   await logLlmUsage({
 *     userId,
 *     type: "ask",
 *     provider: "vllm-local",
 *     model: "Qwen/Qwen3.5-35B-A3B-FP8",
 *     location: "dgx-spark",
 *     endpoint: "http://127.0.0.1:8355/v1",
 *     route: "/api/ask",
 *     promptTokens: result.usage?.prompt_tokens,
 *     completionTokens: result.usage?.completion_tokens,
 *     latencyMs: Date.now() - start,
 *     statusCode: 200,
 *   });
 */

export interface LlmUsageInput {
  userId: string;
  type: string;
  // Model routing
  provider?: string;
  model?: string;
  location?: string;
  endpoint?: string;
  // Tokens
  promptTokens?: number;
  completionTokens?: number;
  tokensApprox?: number;
  // Performance
  latencyMs?: number;
  statusCode?: number;
  errorMessage?: string;
  requestId?: string;
  // Context
  route?: string;
  // Extra
  meta?: Record<string, unknown>;
}

export async function logLlmUsage(input: LlmUsageInput): Promise<void> {
  try {
    const totalTokens =
      (input.tokensApprox ??
      ((input.promptTokens || 0) + (input.completionTokens || 0))) || null;

    await prisma.usageEvent.create({
      data: {
        userId: input.userId,
        type: input.type,
        provider: input.provider || null,
        model: input.model || null,
        location: input.location || null,
        endpoint: input.endpoint || null,
        route: input.route || null,
        promptTokens: input.promptTokens || null,
        completionTokens: input.completionTokens || null,
        tokensApprox: totalTokens,
        latencyMs: input.latencyMs || null,
        statusCode: input.statusCode || null,
        errorMessage: input.errorMessage || null,
        requestId: input.requestId || null,
        meta: input.meta ? JSON.parse(JSON.stringify(input.meta)) : undefined,
      },
    });
  } catch {
    // Never let logging crash the main flow
    console.error("[llm-usage] Failed to log usage event");
  }
}

/**
 * Helper to wrap an LLM fetch call with automatic usage logging.
 *
 * Usage:
 *   const { response, json } = await trackedLlmCall({
 *     userId,
 *     type: "ask",
 *     provider: "anthropic",
 *     model: "claude-sonnet-4-20250514",
 *     location: "cloud-us",
 *     endpoint: "https://api.anthropic.com",
 *     route: "/api/ask",
 *     fetchFn: () => fetch(url, options),
 *   });
 */
export async function trackedLlmCall({
  userId,
  type,
  provider,
  model,
  location,
  endpoint,
  route,
  meta,
  fetchFn,
}: {
  userId: string;
  type: string;
  provider?: string;
  model?: string;
  location?: string;
  endpoint?: string;
  route?: string;
  meta?: Record<string, unknown>;
  fetchFn: () => Promise<Response>;
}): Promise<{ response: Response; json: Record<string, unknown>; latencyMs: number }> {
  const start = Date.now();
  let response: Response;
  let json: Record<string, unknown> = {};
  let statusCode: number;
  let errorMessage: string | undefined;

  try {
    response = await fetchFn();
    statusCode = response.status;
    try {
      json = await response.json();
    } catch {
      json = {};
    }
  } catch (err) {
    statusCode = 0;
    errorMessage = err instanceof Error ? err.message : "fetch failed";
    throw err;
  } finally {
    const latencyMs = Date.now() - start;

    // Extract tokens from OpenAI-compatible response
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const usage = (json as any)?.usage;

    await logLlmUsage({
      userId,
      type,
      provider,
      model,
      location,
      endpoint,
      route,
      promptTokens: usage?.prompt_tokens,
      completionTokens: usage?.completion_tokens,
      tokensApprox: usage?.total_tokens,
      latencyMs,
      statusCode: statusCode!,
      errorMessage,
      meta,
    });
  }

  return { response: response!, json, latencyMs: Date.now() - start };
}

// ─── Video generation usage logging ──────────────────────

export async function logVideoUsage(input: {
  userId: string;
  model: string;        // "wan-2.6" | "veo3-fast" | "veo3"
  tier: string;
  creditsUsed: number;
  costCents: number;
  latencyMs?: number;
  generationId?: string;
  errorMessage?: string;
}): Promise<void> {
  await logLlmUsage({
    userId: input.userId,
    type: "video_generation",
    provider: "fal-ai",
    model: input.model,
    location: "cloud",
    endpoint: "https://queue.fal.run",
    route: "/api/video/generate",
    tokensApprox: input.costCents, // map cost cents as "tokens" for analytics
    latencyMs: input.latencyMs,
    statusCode: input.errorMessage ? 500 : 200,
    errorMessage: input.errorMessage,
    meta: {
      tier: input.tier,
      creditsUsed: input.creditsUsed,
      costCents: input.costCents,
      generationId: input.generationId,
    },
  });
}

// ─── Provider presets for quick usage ────────────────────
// Update these as you switch models/providers

export const LLM_PROVIDERS = {
  dgxSpark: {
    provider: "vllm-local",
    model: process.env.LLM_MODEL || "Qwen/Qwen3.5-35B-A3B-FP8",
    location: "dgx-spark",
    endpoint: process.env.LLM_API_URL || "http://127.0.0.1:8355/v1",
  },
  anthropic: {
    provider: "anthropic",
    model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-20250514",
    location: "cloud-us",
    endpoint: "https://api.anthropic.com",
  },
  openai: {
    provider: "openai",
    model: process.env.OPENAI_MODEL || "gpt-4o",
    location: "cloud-us",
    endpoint: "https://api.openai.com/v1",
  },
  groq: {
    provider: "groq",
    model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
    location: "cloud-us",
    endpoint: "https://api.groq.com/openai/v1",
  },
} as const;
