/**
 * Chat → structured Modal job card.
 *
 * Returns ONLY parsed JSON matching generateJobCardSchema (plus an optional
 * director `reply`). Prefers Spark Qwen vLLM when QWEN_VLLM_* is set; else LiteLLM / LLM_*.
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
  "max_sequence_length": 512,
  "identity_ref_urls": ["https://...front", "https://...left", "https://...right"],
  "extra_image_urls": [],
  "sigmas": null,
  "attention_kwargs": null,
  "pipe_overrides": {},
  "num_images": 1
}

RULES
- Output JSON only. No credentials, tokens, or Modal account fields.
- Keep proven defaults unless Jared asks to change them: width=928, height=1664, steps=40, true_cfg_scale=4.0, guidance_scale=1.0, max_sequence_length=512.
- true_cfg_scale is the CFG for this recipe (what Comfy users mean by CFG). guidance_scale is mostly unused on Qwen-Image-Edit — keep 1 unless he asks.
- Identity lock is three HTTPS reference URLs (front, left profile, right profile). Never invent Spark filesystem paths. If he does not change refs, copy the current URLs unchanged.
- extra_image_urls is 0–3 extra HTTPS edit/style refs, appended after identity_ref_urls on Modal. HTTPS only. Leave [] if unused.
- sigmas is an optional number array (or null). Omit or null when empty — do not invent a schedule.
- attention_kwargs is an optional object passed to the Diffusers AttentionProcessor. Use {} / null if unused.
- pipe_overrides (alias modal_kwargs) is a free-form object of extra QwenImageEditPlusPipeline.__call__ kwargs. It is sanitized (no tokens, no Spark paths, no denoise/strength) and deep-merged onto spawn kwargs AFTER the typed fields. Put any future/pipe arg Jared pastes here.
- This recipe has NO denoise/strength. Never invent those fields and never claim they exist. Control with steps, true_cfg_scale (CFG), and negative_prompt.
- If he asks for the preset "Lady2 lacy pink front smile" (or lady2 / lacy pink / front smile), set preset to "lady2-lacy-pink-front-smile" and use that wardrobe/identity prompt pattern: same woman as the three grey-shirt identity refs, lacy pink front, soft smile, 9:16 photoreal.
- Empty string on a field means leave the current card value. Always send a complete prompt when you change wardrobe or pose.
- num_images is 1–4. seed is an integer ≥ 0. max_sequence_length is 64–2048 (default 512).

HEADLESS CONTROL (hard rule)
Never mention ComfyUI, Comfy nodes, node graphs, .safetensors files, or "open the Comfy interface". This page is headless Modal kwargs / job-card form fields only. Do not invent node-graph, checkpoint, or Comfy workflow advice.
Chat MAY change any of these card fields when asked: seed, num_inference_steps, width, height, true_cfg_scale, guidance_scale, max_sequence_length, num_images, negative_prompt, identity_ref_urls, extra_image_urls, sigmas, attention_kwargs, pipe_overrides, modal_kwargs, prompt.`;

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

  // /generate Modal stills: prefer Spark Qwen 3.8 when configured. Site-wide
  // LITELLM_* often defaults to broken fallback/kimi groups and must not win.
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

  if (llmBase(env)) {
    try {
      const text = await chatOpenAiCompatible(env, message, card);
      const parsed = parseLlmJobCard(text, card);
      return { ...parsed, model: llmBase(env)!.model };
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      throw new Error(
        `LiteLLM chat→card failed (${detail}). Set QWEN_VLLM_BASE_URL for Spark Qwen 3.8.`,
      );
    }
  }

  throw new Error(
    "No LLM configured for chat→card. Set QWEN_VLLM_BASE_URL (preferred) or LITELLM_API_URL.",
  );
}
