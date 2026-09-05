/**
 * Chat → structured /generate motion card.
 * Same LLM preference as Modal stills (Spark Qwen, then LiteLLM).
 */

import {
  MOTION_CARD_SYSTEM_PROMPT,
  emptyMotionCard,
  parseLlmMotionCard,
  type GenerateMotionCard,
} from "./generate-motion-card";
import { isJobCardLlmConfigured } from "./generate-job-llm";
import { isQwenConfigured, qwenChatCompletion } from "./qwen-vllm";

export { isJobCardLlmConfigured as isMotionCardLlmConfigured };

function llmBase(env: NodeJS.ProcessEnv): { url: string; key: string; model: string } | null {
  const url = (env.LITELLM_API_URL || env.LLM_API_URL || "").trim().replace(/\/+$/, "");
  const key = (env.LITELLM_API_KEY || env.LLM_API_KEY || "").trim();
  const model = (env.LITELLM_MODEL || env.LLM_MODEL || "").trim() || "fallback/kimi-k2-turbo";
  if (!url) return null;
  return { url, key: key && key !== "none" ? key : "", model };
}

function cardUserPayload(
  message: string,
  current: GenerateMotionCard | ReturnType<typeof emptyMotionCard>,
): string {
  return [
    "Current motion card:",
    JSON.stringify(current, null, 2),
    "",
    "Stack: fal-ai/wan-i2v (first frame) or fal-ai/wan-flf2v (first+last still). No Seedance. No LatentSync. No stitch. No skeleton video.",
    "",
    "User:",
    message.trim(),
  ].join("\n");
}

async function chatOpenAiCompatible(
  env: NodeJS.ProcessEnv,
  message: string,
  current: GenerateMotionCard | ReturnType<typeof emptyMotionCard>,
): Promise<string> {
  const cfg = llmBase(env);
  if (!cfg) throw new Error("No LiteLLM/LLM endpoint configured");
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (cfg.key) headers.Authorization = `Bearer ${cfg.key}`;
  const completionsUrl = cfg.url.endsWith("/chat/completions")
    ? cfg.url
    : `${cfg.url}/chat/completions`;
  const res = await fetch(completionsUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: cfg.model,
      messages: [
        { role: "system", content: MOTION_CARD_SYSTEM_PROMPT },
        { role: "user", content: cardUserPayload(message, current) },
      ],
      max_tokens: 1200,
      temperature: 0.2,
      extra_body: { chat_template_kwargs: { enable_thinking: false } },
    }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`LLM ${res.status}: ${text.slice(0, 240)}`);
  }
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = data.choices?.[0]?.message?.content?.trim() || "";
  if (!text) throw new Error("Empty LLM response");
  return text;
}

export async function fillMotionCardFromChat(
  message: string,
  current?: GenerateMotionCard | ReturnType<typeof emptyMotionCard> | null,
  env: NodeJS.ProcessEnv = process.env,
): Promise<{
  card: GenerateMotionCard | ReturnType<typeof emptyMotionCard>;
  reply: string;
  model: string;
}> {
  const card = current ?? emptyMotionCard();

  if (isQwenConfigured(env)) {
    const result = await qwenChatCompletion(
      [
        { role: "system", content: MOTION_CARD_SYSTEM_PROMPT },
        { role: "user", content: cardUserPayload(message, card) },
      ],
      { env, maxTokens: 1200, temperature: 0.2 },
    );
    const parsed = parseLlmMotionCard(result.text, card);
    return { ...parsed, model: result.model };
  }

  if (llmBase(env)) {
    try {
      const text = await chatOpenAiCompatible(env, message, card);
      const parsed = parseLlmMotionCard(text, card);
      return { ...parsed, model: llmBase(env)!.model };
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      throw new Error(
        `LiteLLM chat→motion card failed (${detail}). Set QWEN_VLLM_BASE_URL for Spark Qwen 3.8.`,
      );
    }
  }

  throw new Error(
    "No LLM configured for chat→card. Set QWEN_VLLM_BASE_URL (preferred) or LITELLM_API_URL.",
  );
}
