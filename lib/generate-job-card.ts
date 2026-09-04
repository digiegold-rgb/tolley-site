/**
 * Structured Modal job card for /generate stills.
 *
 * Modal is API kwargs, not a frozen GUI. Chat (or the form) fills this object;
 * Confirm/Go sends it as kwargs to the named Modal function
 * `qwen_image_edit` (QwenImageEditPlusPipeline / Qwen-Image-Edit-2511 BF16).
 *
 * Proven defaults from Spark/Modal runs that worked:
 *   width=928 height=1664 steps=40 true_cfg_scale=4.0 guidance_scale=1.0
 *
 * Identity refs are durable HTTPS URLs (Vercel Blob or similar). Never pass
 * Spark paths like /home/jelly/growth-engine/... onto Modal workers.
 */

import { z } from "zod";

export const GENERATE_RECIPE = "qwen-image-edit-2511" as const;
export const GENERATE_JOB_STATUSES = ["queued", "running", "done", "failed"] as const;
export type GenerateJobStatus = (typeof GENERATE_JOB_STATUSES)[number];

export const PROVEN_DEFAULTS = {
  width: 928,
  height: 1664,
  num_inference_steps: 40,
  true_cfg_scale: 4.0,
  guidance_scale: 1.0,
  num_images: 1,
  seed: 0,
  negative_prompt: " ",
} as const;

/** Historical Spark paths — documented only. Do not load these on Modal. */
export const HISTORICAL_IDENTITY_REF_PATHS = {
  front: "/home/jelly/growth-engine/shorts/persona-refs/identity/front.jpg",
  left: "/home/jelly/growth-engine/shorts/persona-refs/identity/profile-left.jpg",
  right: "/home/jelly/growth-engine/shorts/persona-refs/identity/profile-right.jpg",
} as const;

export const LADY2_LACY_PINK_PRESET_ID = "lady2-lacy-pink-front-smile" as const;

export const LADY2_LACY_PINK_PROMPT = [
  "The same adult woman as the three grey-shirt identity reference photos (front, left profile, right profile).",
  "Keep her exact face, bone structure, skin, hair, and age. Do not invent a different person.",
  "Wardrobe: lacy pink — a delicate lacy pink lingerie set, feminine lace texture, photoreal fabric, front view.",
  "Pose and expression: facing camera, front view, soft natural smile, relaxed shoulders, confident, adult.",
  "Camera: vertical 9:16 portrait, 85mm, eye-level, shallow depth of field.",
  "Lighting: soft studio key, gentle rim light, clean tasteful background.",
  "Photoreal, natural skin texture, high detail. No illustration, no cartoon, no text, no watermark.",
].join(" ");

export const LADY2_LACY_PINK_NEGATIVE =
  "different person, identity drift, deformed face, extra limbs, child, minor, blurry, lowres, watermark, text, cartoon, illustration";

const urlList = z
  .array(z.string().trim())
  .max(6)
  .transform((urls) => urls.map((u) => u.trim()).filter(Boolean));

export const generateJobCardSchema = z.object({
  recipe: z.literal(GENERATE_RECIPE).default(GENERATE_RECIPE),
  preset: z.string().trim().max(80).optional().nullable(),
  prompt: z.string().trim().min(1).max(8000),
  negative_prompt: z.string().max(4000).default(PROVEN_DEFAULTS.negative_prompt),
  seed: z.coerce.number().int().min(0).max(2_147_483_647).default(PROVEN_DEFAULTS.seed),
  num_inference_steps: z.coerce.number().int().min(1).max(80).default(PROVEN_DEFAULTS.num_inference_steps),
  height: z.coerce.number().int().min(256).max(2048).default(PROVEN_DEFAULTS.height),
  width: z.coerce.number().int().min(256).max(2048).default(PROVEN_DEFAULTS.width),
  true_cfg_scale: z.coerce.number().min(0).max(20).default(PROVEN_DEFAULTS.true_cfg_scale),
  guidance_scale: z.coerce.number().min(0).max(20).default(PROVEN_DEFAULTS.guidance_scale),
  identity_ref_urls: urlList.default([]),
  num_images: z.coerce.number().int().min(1).max(4).default(PROVEN_DEFAULTS.num_images),
});

export type GenerateJobCard = z.infer<typeof generateJobCardSchema>;

export type GeneratePreset = {
  id: string;
  label: string;
  prompt: string;
  negative_prompt: string;
};

export const GENERATE_PRESETS: GeneratePreset[] = [
  {
    id: LADY2_LACY_PINK_PRESET_ID,
    label: "Lady2 lacy pink front smile",
    prompt: LADY2_LACY_PINK_PROMPT,
    negative_prompt: LADY2_LACY_PINK_NEGATIVE,
  },
];

export function defaultIdentityRefUrls(env: NodeJS.ProcessEnv = process.env): string[] {
  const packed = (env.GENERATE_IDENTITY_REF_URLS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (packed.length) return packed.slice(0, 3);
  return [
    env.GENERATE_IDENTITY_REF_FRONT_URL,
    env.GENERATE_IDENTITY_REF_LEFT_URL,
    env.GENERATE_IDENTITY_REF_RIGHT_URL,
  ]
    .map((s) => (s || "").trim())
    .filter(Boolean);
}

export function defaultJobCard(
  presetId: string | null = LADY2_LACY_PINK_PRESET_ID,
  env: NodeJS.ProcessEnv = process.env,
): GenerateJobCard {
  const preset = GENERATE_PRESETS.find((p) => p.id === presetId) ?? GENERATE_PRESETS[0];
  return generateJobCardSchema.parse({
    recipe: GENERATE_RECIPE,
    ...PROVEN_DEFAULTS,
    preset: preset.id,
    prompt: preset.prompt,
    negative_prompt: preset.negative_prompt,
    identity_ref_urls: defaultIdentityRefUrls(env),
  });
}

export function applyPreset(card: GenerateJobCard, presetId: string): GenerateJobCard {
  const preset = GENERATE_PRESETS.find((p) => p.id === presetId);
  if (!preset) return card;
  return {
    ...card,
    preset: preset.id,
    prompt: preset.prompt,
    negative_prompt: preset.negative_prompt,
  };
}

export function parseGenerateJobCard(raw: unknown): GenerateJobCard {
  return generateJobCardSchema.parse(raw);
}

/** Merge a partial LLM/user patch onto a card. Empty strings leave the field. */
export function mergeJobCard(base: GenerateJobCard, patch: unknown): GenerateJobCard {
  const rec = patch && typeof patch === "object" && !Array.isArray(patch)
    ? (patch as Record<string, unknown>)
    : {};
  const next: Record<string, unknown> = { ...base };
  for (const key of Object.keys(generateJobCardSchema.shape)) {
    if (!(key in rec)) continue;
    const value = rec[key];
    if (value === undefined || value === null) continue;
    if (typeof value === "string" && value.trim() === "" && key !== "negative_prompt") continue;
    next[key] = value;
  }
  if (typeof rec.preset === "string" && rec.preset.trim()) {
    const preset = GENERATE_PRESETS.find((p) => p.id === rec.preset || p.label === rec.preset);
    if (preset && (!rec.prompt || String(rec.prompt).trim() === "")) {
      next.prompt = preset.prompt;
      next.negative_prompt = rec.negative_prompt ?? preset.negative_prompt;
      next.preset = preset.id;
    }
  }
  return generateJobCardSchema.parse(next);
}

export function extractJsonObject(raw: string): Record<string, unknown> | null {
  let cleaned = raw.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  try {
    const parsed = JSON.parse(cleaned) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    /* fall through */
  }
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    return null;
  }
  return null;
}

export function parseLlmJobCard(raw: string, current: GenerateJobCard): {
  card: GenerateJobCard;
  reply: string;
} {
  const obj = extractJsonObject(raw);
  if (!obj) {
    throw new Error("LLM did not return a job-card JSON object");
  }
  const reply = typeof obj.reply === "string" ? obj.reply.trim() : "";
  const patch = (obj.card && typeof obj.card === "object" ? obj.card : obj) as Record<string, unknown>;
  const { reply: _r, card: _c, ...fields } = patch;
  void _r;
  void _c;
  return {
    card: mergeJobCard(current, fields),
    reply: reply || "Updated the job card — edit it, then Confirm/Go.",
  };
}

export type ModalSpawnKwargs = {
  prompt: string;
  negative_prompt: string;
  seed: number;
  num_inference_steps: number;
  height: number;
  width: number;
  true_cfg_scale: number;
  guidance_scale: number;
  identity_ref_urls: string[];
  num_images: number;
  job_id?: string;
  webhook_url?: string;
};

export function cardToModalKwargs(
  card: GenerateJobCard,
  extras?: { job_id?: string; webhook_url?: string },
): ModalSpawnKwargs {
  return {
    prompt: card.prompt,
    negative_prompt: card.negative_prompt || " ",
    seed: card.seed,
    num_inference_steps: card.num_inference_steps,
    height: card.height,
    width: card.width,
    true_cfg_scale: card.true_cfg_scale,
    guidance_scale: card.guidance_scale,
    identity_ref_urls: card.identity_ref_urls,
    num_images: card.num_images,
    ...(extras?.job_id ? { job_id: extras.job_id } : {}),
    ...(extras?.webhook_url ? { webhook_url: extras.webhook_url } : {}),
  };
}

export function isGenerateJobStatus(value: string): value is GenerateJobStatus {
  return (GENERATE_JOB_STATUSES as readonly string[]).includes(value);
}
