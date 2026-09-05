/**
 * Structured Modal job card for /generate stills.
 *
 * Modal is API kwargs, not a frozen GUI. Chat (or the form) fills this object;
 * Confirm/Go sends it as kwargs to the named Modal function
 * `qwen_image_edit` (QwenImageEditPlusPipeline / Qwen-Image-Edit-2511 BF16).
 *
 * Proven defaults from Spark/Modal runs that worked:
 *   width=928 height=1664 steps=40 true_cfg_scale=4.0 guidance_scale=1.0
 *   max_sequence_length=512
 *
 * Identity refs are durable HTTPS URLs (Vercel Blob or similar). Never pass
 * Spark paths like /home/jelly/growth-engine/... onto Modal workers.
 * extra_image_urls (max 3, HTTPS) are edit/style refs appended after identity
 * when calling Modal. sigmas is optional — omit when empty. pipe_overrides is
 * a free-form Diffusers pipe() escape hatch (sanitized). This recipe has
 * no denoise/strength.
 */

import { z } from "zod";

export const GENERATE_RECIPE = "qwen-image-edit-2511" as const;
export const GENERATE_JOB_STATUSES = ["queued", "running", "done", "failed"] as const;
export type GenerateJobStatus = (typeof GENERATE_JOB_STATUSES)[number];

/**
 * JSON-safe values Prisma can persist on `cardJson`.
 * Type aliases (not interfaces) so the job card keeps an implicit index
 * signature and assigns to Prisma `InputJsonValue` / `InputJsonObject`.
 * `Record<string, unknown>` does not — `unknown` is not JSON.
 */
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };
export type JsonObject = { [key: string]: JsonValue };

export const PROVEN_DEFAULTS = {
  width: 928,
  height: 1664,
  num_inference_steps: 40,
  true_cfg_scale: 4.0,
  guidance_scale: 1.0,
  max_sequence_length: 512,
  num_images: 1,
  seed: 0,
  negative_prompt: " ",
  extra_image_urls: [] as string[],
  sigmas: null as number[] | null,
  attention_kwargs: null as JsonObject | null,
  pipe_overrides: {} as JsonObject,
};

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

export function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

const extraImageUrls = z.preprocess((raw) => {
  if (typeof raw === "string") {
    return raw.split(",").map((s) => s.trim()).filter(Boolean);
  }
  return raw;
}, z
  .array(z.string())
  .max(3)
  .transform((urls) => urls.map((u) => u.trim()).filter(Boolean))
  .refine((urls) => urls.every(isHttpsUrl), {
    message: "extra_image_urls must be HTTPS URLs (max 3)",
  })
  .default([]));

const sigmaList = z.preprocess((raw) => {
  if (typeof raw === "string") {
    const parts = raw.split(/[,\s]+/).map((s) => s.trim()).filter(Boolean);
    return parts.length ? parts : null;
  }
  if (Array.isArray(raw) && raw.length === 0) return null;
  return raw;
}, z
  .union([z.null(), z.array(z.coerce.number().finite())])
  .optional()
  .nullable()
  .transform((v) => (v && v.length ? v : null))
  .default(null));

/** Keys that must never ride along as Diffusers / Modal overrides. */
export const PIPE_OVERRIDE_SECRET_KEY = /token|secret|password|api_key|authorization|hf_/i;
export const PIPE_OVERRIDE_INTERNAL_KEY =
  /^(image|generator|job_id|webhook_url|callback_on_step_end|denoise|strength|denoising_strength)$/i;

function isSparkPathString(value: string): boolean {
  return value.includes("/home/") || value.includes("/Users/");
}

function isPlainJsonValue(value: unknown): value is JsonValue {
  if (value === null) return true;
  if (typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(isPlainJsonValue);
  if (typeof value === "object") {
    return Object.values(value as Record<string, unknown>).every(isPlainJsonValue);
  }
  return false;
}

function sanitizeJsonValue(value: unknown): JsonValue | undefined {
  if (value === null) return null;
  if (typeof value === "string") {
    if (isSparkPathString(value)) return undefined;
    return value;
  }
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value === "boolean") return value;
  if (Array.isArray(value)) {
    const items: JsonValue[] = [];
    for (const item of value) {
      const cleaned = sanitizeJsonValue(item);
      if (cleaned !== undefined) items.push(cleaned);
    }
    return items;
  }
  if (typeof value === "object") {
    return sanitizePipeOverrides(value);
  }
  return undefined;
}

/** Drop secrets, Spark paths, and non-JSON values from a free-form override bag. */
export function sanitizePipeOverrides(obj: unknown): JsonObject {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return {};
  const out: JsonObject = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (!key || PIPE_OVERRIDE_SECRET_KEY.test(key) || PIPE_OVERRIDE_INTERNAL_KEY.test(key)) continue;
    if (typeof value === "string" && isSparkPathString(value)) continue;
    const cleaned = sanitizeJsonValue(value);
    if (cleaned === undefined || !isPlainJsonValue(cleaned)) continue;
    out[key] = cleaned;
  }
  return out;
}

function sanitizeAttentionKwargs(raw: unknown): JsonObject | null {
  const clean = sanitizePipeOverrides(raw);
  return Object.keys(clean).length ? clean : null;
}

export function formatPipeOverridesJson(
  overrides: JsonObject | Record<string, unknown> | null | undefined,
): string {
  const clean = sanitizePipeOverrides(overrides ?? {});
  return Object.keys(clean).length ? JSON.stringify(clean, null, 2) : "";
}

export function parsePipeOverridesJson(raw: string): JsonObject {
  const trimmed = raw.trim();
  if (!trimmed) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    throw new Error("pipe_overrides must be a JSON object");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("pipe_overrides must be a JSON object");
  }
  return sanitizePipeOverrides(parsed);
}

const pipeOverrides = z.preprocess((raw) => {
  if (raw == null) return {};
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return {};
    try {
      return JSON.parse(trimmed);
    } catch {
      return raw;
    }
  }
  return raw;
}, z.record(z.string(), z.unknown()).default({}).transform((v): JsonObject => sanitizePipeOverrides(v)));

const attentionKwargs = z.preprocess((raw) => {
  if (raw && typeof raw === "object" && !Array.isArray(raw) && Object.keys(raw as object).length) {
    return raw;
  }
  return null;
}, z
  .union([z.null(), z.record(z.string(), z.unknown())])
  .optional()
  .nullable()
  .default(null)
  .transform((v): JsonObject | null => sanitizeAttentionKwargs(v)));

function aliasModalKwargs(raw: unknown): unknown {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  const rec = { ...(raw as Record<string, unknown>) };
  if (rec.modal_kwargs && typeof rec.modal_kwargs === "object" && !Array.isArray(rec.modal_kwargs)) {
    const existing = rec.pipe_overrides && typeof rec.pipe_overrides === "object" && !Array.isArray(rec.pipe_overrides)
      ? (rec.pipe_overrides as Record<string, unknown>)
      : {};
    rec.pipe_overrides = sanitizePipeOverrides({
      ...existing,
      ...(rec.modal_kwargs as Record<string, unknown>),
    });
  }
  delete rec.modal_kwargs;
  return rec;
}

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
  max_sequence_length: z.coerce
    .number()
    .int()
    .min(64)
    .max(2048)
    .default(PROVEN_DEFAULTS.max_sequence_length),
  identity_ref_urls: urlList.default([]),
  extra_image_urls: extraImageUrls,
  sigmas: sigmaList,
  attention_kwargs: attentionKwargs,
  pipe_overrides: pipeOverrides,
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
  return generateJobCardSchema.parse(aliasModalKwargs(raw));
}

export const SEED_MAX = 2_147_483_647;

/** Integer seed in the card/Modal range. Pass `rng` in tests. */
export function randomSeed(rng: () => number = Math.random): number {
  const unit = Math.min(Math.max(rng(), 0), 1 - Number.EPSILON);
  return Math.min(SEED_MAX, Math.floor(unit * (SEED_MAX + 1)));
}

export function formatJobCardJson(card: GenerateJobCard): string {
  return JSON.stringify(card, null, 2);
}

/** Comma-separated floats for the Advanced sigmas textarea. Empty → null. */
export function parseSigmasText(raw: string): number[] | null {
  const parts = raw
    .split(/[,\s]+/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (!parts.length) return null;
  const nums = parts.map((p) => Number(p));
  if (nums.some((n) => !Number.isFinite(n))) {
    throw new Error("sigmas must be comma-separated numbers");
  }
  return nums;
}

export function formatSigmasText(sigmas: number[] | null | undefined): string {
  return sigmas?.length ? sigmas.join(", ") : "";
}

/** Round-trip helper for the Advanced JSON editor. */
export function parseJobCardJson(raw: string): GenerateJobCard {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Advanced JSON is not valid JSON");
  }
  return parseGenerateJobCard(parsed);
}

export const GENERATE_JOB_CARD_KEYS = Object.keys(
  generateJobCardSchema.shape,
) as Array<keyof GenerateJobCard>;

/** Merge a partial LLM/user patch onto a card. Empty strings leave the field. */
export function mergeJobCard(base: GenerateJobCard, patch: unknown): GenerateJobCard {
  const rec = patch && typeof patch === "object" && !Array.isArray(patch)
    ? (aliasModalKwargs(patch) as Record<string, unknown>)
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
  max_sequence_length: number;
  identity_ref_urls: string[];
  extra_image_urls: string[];
  sigmas?: number[];
  attention_kwargs?: JsonObject;
  pipe_overrides?: JsonObject;
  num_images: number;
  job_id?: string;
  webhook_url?: string;
};

export const MODAL_SPAWN_KWARG_KEYS = [
  "prompt",
  "negative_prompt",
  "seed",
  "num_inference_steps",
  "height",
  "width",
  "true_cfg_scale",
  "guidance_scale",
  "max_sequence_length",
  "identity_ref_urls",
  "extra_image_urls",
  "num_images",
] as const satisfies ReadonlyArray<keyof ModalSpawnKwargs>;

const IDENTITY_KWARG_KEYS = new Set(["job_id", "webhook_url"]);

export function cardToModalKwargs(
  card: GenerateJobCard,
  extras?: { job_id?: string; webhook_url?: string },
): ModalSpawnKwargs {
  const extraUrls = card.extra_image_urls ?? [];
  const sigmas = card.sigmas && card.sigmas.length ? card.sigmas : undefined;
  const typed: ModalSpawnKwargs = {
    prompt: card.prompt,
    negative_prompt: card.negative_prompt || " ",
    seed: card.seed,
    num_inference_steps: card.num_inference_steps,
    height: card.height,
    width: card.width,
    true_cfg_scale: card.true_cfg_scale,
    guidance_scale: card.guidance_scale,
    max_sequence_length: card.max_sequence_length,
    identity_ref_urls: card.identity_ref_urls,
    extra_image_urls: extraUrls,
    ...(sigmas ? { sigmas } : {}),
    ...(card.attention_kwargs && Object.keys(card.attention_kwargs).length
      ? { attention_kwargs: card.attention_kwargs }
      : {}),
    num_images: card.num_images,
    ...(extras?.job_id ? { job_id: extras.job_id } : {}),
    ...(extras?.webhook_url ? { webhook_url: extras.webhook_url } : {}),
  };
  const overrides = sanitizePipeOverrides(card.pipe_overrides);
  const bag: JsonObject = {};
  for (const [key, value] of Object.entries(overrides)) {
    if (IDENTITY_KWARG_KEYS.has(key) || PIPE_OVERRIDE_INTERNAL_KEY.test(key)) continue;
    bag[key] = value;
    if (key in typed && key !== "pipe_overrides") {
      (typed as Record<string, unknown>)[key] = value;
    }
  }
  return {
    ...typed,
    ...(Object.keys(bag).length ? { pipe_overrides: bag } : {}),
    ...(extras?.job_id ? { job_id: extras.job_id } : {}),
    ...(extras?.webhook_url ? { webhook_url: extras.webhook_url } : {}),
  };
}

export function isGenerateJobStatus(value: string): value is GenerateJobStatus {
  return (GENERATE_JOB_STATUSES as readonly string[]).includes(value);
}
