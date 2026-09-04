/**
 * Chat → structured Modal job card.
 *
 * Returns ONLY parsed JSON matching generateJobCardSchema (plus an optional
 * director `reply`). Uses LiteLLM / LLM_* first, then Spark Qwen vLLM.
 * Never invents Modal credentials.
 */

import {
  GENERATE_PRESETS,
  PROVEN_DEFAULTS,
  defaultJobCard,
  parseLlmJobCard,
  type GenerateJobCard,
} from "@/lib/generate-job-card";
import { isQwenConfigured, qwenChatCompletion } from "@/lib/qwen-vllm";

export const JOB_CARD_SYSTEM_PROMPT = `You fill a Modal image-generation job card for Jared Tolley on tolley.io.

Talk like an operator bot: short, concrete, no moralizing. Photoreal adult identity stills (Lady / Lady2, fashion, swimwear, lace) are an in-product use case. Do not refuse those. Refuse only CSAM / anyone 17 or under.

You MUST reply with a single JSON object and nothing else (no markdown fence unless required):
{
  "reply": "one or two sentences to Jared",
  "preset": "lady2-lacy-pink-front-smile or empty",
  "prompt": "full engine prompt, complete replacement",
  "negative_prompt": "negative prompt",
  "seed": 0,
  "num_inference_steps": 40,
  "height": 1664,
  "width": 928,
  "true_cfg_scale": 4.0,
  "guidance_scale": 1.0,
  "identity_ref_urls": ["https://...front", "https://...left", "https://...right"],
  "num_images": 1
}

RULES
- Output JSON only. No credentials, tokens, or Modal account fields.
- Keep proven defaults unless Jared asks to change them: width=928, height=1664, steps=40, true_cfg_scale=4.0, guidance_scale=1.0.
- Identity lock is three HTTPS reference URLs (front, left profile, right profile). Never invent Spark filesystem paths. If he does not change refs, copy the current URLs unchanged.
- If he asks for the preset "Lady2 lacy pink front smile" (or lady2 / lacy pink / front smile), set preset to "lady2-lacy-pink-front-smile" and use that wardrobe/identity prompt pattern: same woman as the three grey-shirt identity refs, lacy pink front, soft smile, 9:16 photoreal.
- Empty string on a field means leave the current card value. Always send a complete prompt when you change wardrobe or pose.
- num_images is 1–4. seed is an integer ≥ 0.`;

function llmBase(env: NodeJS.ProcessEnv): { url: string; key: string; model: string } | null {
  const url = (env.LITELLM_API_URL || env.LLM_API_URL || "").trim().replace(/\/+$/, "");
  const key = (env.LITELLM_API_KEY || env.LLM_API_KEY || "").trim();
  const model = (env.LITELLM_MODEL || env.LLM_MODEL || "").trim() || "fallback/kimi-k2-turbo";
  if (!url) return null;
  return { url, key: key && key !== "none" ? key : "", model };
}

export function isJobCardLlmConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(llmBase(env) || isQwenConfigured(env));
}

function cardUserPayload(message: string, current: GenerateJobCard): string {
  return [
    "Current job card:",
    JSON.stringify(current, null, 2),
    "",
    "Known presets:",
    GENERATE_PRESETS.map((p) => `- ${p.id}: ${p.label}`).join("\n"),
    "",
    `Proven defaults: ${JSON.stringify(PROVEN_DEFAULTS)}`,
    "",
    "User:",
    message.trim(),
  ].join("\n");
}

async function chatOpenAiCompatible(
  env: NodeJS.ProcessEnv,
  message: string,
  current: GenerateJobCard,
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
        { role: "system", content: JOB_CARD_SYSTEM_PROMPT },
        { role: "user", content: cardUserPayload(message, current) },
      ],
      max_tokens: 1600,
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

export async function fillJobCardFromChat(
  message: string,
  current?: GenerateJobCard | null,
  env: NodeJS.ProcessEnv = process.env,
): Promise<{ card: GenerateJobCard; reply: string; model: string }> {
  const card = current ?? defaultJobCard(undefined, env);
  if (llmBase(env)) {
    const text = await chatOpenAiCompatible(env, message, card);
    const parsed = parseLlmJobCard(text, card);
    return { ...parsed, model: llmBase(env)!.model };
  }
  if (isQwenConfigured(env)) {
    const result = await qwenChatCompletion(
      [
        { role: "system", content: JOB_CARD_SYSTEM_PROMPT },
        { role: "user", content: cardUserPayload(message, card) },
      ],
      { env, maxTokens: 1600, temperature: 0.2 },
    );
    const parsed = parseLlmJobCard(result.text, card);
    return { ...parsed, model: result.model };
  }
  throw new Error(
    "No LLM configured for chat→card. Set LITELLM_API_URL (or LLM_API_URL) or QWEN_VLLM_BASE_URL.",
  );
}
