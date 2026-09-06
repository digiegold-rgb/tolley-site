/**
 * Structured /generate motion card — identity-locked image→video.
 *
 * Motion 1 (filmstrip) stays on the legacy stack:
 *   - fal-ai/wan-i2v        first-frame I2V (~5s @ 16fps / 81 frames)
 *   - fal-ai/wan-flf2v      first+last frame when a pose / end still is set
 *
 * Motion 2 · Longform uses Wan 3.0 (`cardToWan30FalInput`):
 *   - alibaba/wan-3.0/image-to-video  duration 2–30s (chips 5 / 15 / 30)
 *
 * Identity is the source still as frame 1. LatentSync is not wired.
 * Skeleton *video* drive is not supported — only an optional last-frame / pose
 * *still*. Optional 0.5× slow-mo remuxes after fal returns.
 * Multi-beat stitch is a separate queue — not one Wan call.
 */

import { z } from "zod";

import { isGatedJobImagePath } from "./generate-output";

export const MOTION_RECIPE_I2V = "fal-wan-i2v" as const;
export const MOTION_RECIPE_FLF2V = "fal-wan-flf2v" as const;
export const MOTION_RECIPES = [MOTION_RECIPE_I2V, MOTION_RECIPE_FLF2V] as const;
export type MotionRecipe = (typeof MOTION_RECIPES)[number];

export const MOTION_SECONDS_DEFAULT = 5;
export const MOTION_SECONDS_LONGFORM_DEFAULT = 15;
export const MOTION_SECONDS_MIN = 2;
export const MOTION_SECONDS_MAX = 30;
export const MOTION_SECONDS_CHIPS = [5, 15, 30] as const;
export type MotionSecondsChip = (typeof MOTION_SECONDS_CHIPS)[number];
export const MOTION_NUM_FRAMES = 81;
export const MOTION_FPS = 16;

export const MOTION_RESOLUTIONS = ["480p", "720p", "1080p"] as const;
export type MotionResolution = (typeof MOTION_RESOLUTIONS)[number];
export const MOTION_RESOLUTION_DEFAULT: MotionResolution = "720p";

export const WAN30_USD_PER_SEC_720P = 0.1;
export const WAN30_USD_PER_SEC_1080P = 0.2;

export const MOTION_ASPECTS = ["9:16", "16:9", "1:1", "auto"] as const;
export type MotionAspect = (typeof MOTION_ASPECTS)[number];

export function clampMotionSeconds(value: unknown, fallback = MOTION_SECONDS_DEFAULT): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(MOTION_SECONDS_MAX, Math.max(MOTION_SECONDS_MIN, Math.round(n)));
}

export function isMotionSecondsChip(value: unknown): value is MotionSecondsChip {
  return (MOTION_SECONDS_CHIPS as readonly number[]).includes(Number(value));
}

export function wan30UsdEstimate(
  seconds: number,
  resolution: MotionResolution = MOTION_RESOLUTION_DEFAULT,
): number {
  const rate = resolution === "1080p" ? WAN30_USD_PER_SEC_1080P : WAN30_USD_PER_SEC_720P;
  return Math.round(clampMotionSeconds(seconds) * rate * 100) / 100;
}

export function wan30AspectRatio(
  aspect: MotionAspect,
): "adaptive" | "16:9" | "1:1" | "9:16" {
  if (aspect === "auto") return "adaptive";
  return aspect;
}

export const DEFAULT_MOTION_PROMPT = [
  "The same adult woman as the first-frame still.",
  "Keep her exact face, bone structure, skin, hair, and age. Do not invent a different person.",
  "Soft natural motion: she breathes, a slight smile, hair and fabric move in a gentle breeze.",
  "Photoreal, identity locked to the first frame. Camera holds. No cut, no morph.",
].join(" ");

export const DEFAULT_MOTION_NEGATIVE =
  "different person, identity drift, deformed face, extra limbs, child, minor, blurry, lowres, watermark, text, cartoon, illustration, still image, morph";

/** fal needs HTTPS; HQ-gated job stills are resolved server-side before spawn. */
export function isAllowedMotionStillUrl(value: string): boolean {
  const u = (value || "").trim();
  return /^https:\/\//i.test(u) || isGatedJobImagePath(u);
}

const httpsUrl = z
  .string()
  .trim()
  .max(2000)
  .refine((u) => isAllowedMotionStillUrl(u), "Must be an HTTPS URL or a Generate gallery still");

const optionalHttpsUrl = z
  .string()
  .trim()
  .max(2000)
  .optional()
  .nullable()
  .transform((u) => {
    const s = (u || "").trim();
    return s ? s : "";
  })
  .refine((u) => !u || isAllowedMotionStillUrl(u), "Must be an HTTPS URL or a Generate gallery still");

export const generateMotionCardSchema = z.object({
  recipe: z.enum(MOTION_RECIPES).default(MOTION_RECIPE_I2V),
  prompt: z.string().trim().min(1).max(5000),
  negative_prompt: z.string().max(2000).default(DEFAULT_MOTION_NEGATIVE),
  source_image_url: httpsUrl,
  end_image_url: optionalHttpsUrl,
  aspect: z.enum(MOTION_ASPECTS).default("9:16"),
  seconds: z.coerce.number().min(MOTION_SECONDS_MIN).max(MOTION_SECONDS_MAX).default(MOTION_SECONDS_DEFAULT),
  resolution: z.enum(MOTION_RESOLUTIONS).default(MOTION_RESOLUTION_DEFAULT),
  audio: z.boolean().default(false),
  enable_safety_checker: z.boolean().default(false),
  enable_prompt_expansion: z.boolean().default(false),
  enable_thinking: z.boolean().default(false),
  seed: z.coerce.number().int().min(0).max(2_147_483_647).default(0),
  /** After fal returns, remux 0.5× (setpts=2*PTS) when ffmpeg is on the runtime. */
  slow_mo: z.boolean().default(false),
});

export type GenerateMotionCard = z.infer<typeof generateMotionCardSchema>;

export function isMotionRecipe(recipe: string | null | undefined): recipe is MotionRecipe {
  return !!recipe && (MOTION_RECIPES as readonly string[]).includes(recipe);
}

export function isFalConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean((env.FAL_KEY || "").trim());
}

export function falPublicStatus(env: NodeJS.ProcessEnv = process.env): {
  configured: boolean;
  provider: "fal.ai";
  i2v: "fal-ai/wan-i2v";
  flf2v: "fal-ai/wan-flf2v";
  faceLock: "not-wired";
  stitch: "concat-approved-beats";
  slowMo: "0.5x-remux";
  skeletonVideo: "not-supported";
} {
  return {
    configured: isFalConfigured(env),
    provider: "fal.ai",
    i2v: "fal-ai/wan-i2v",
    flf2v: "fal-ai/wan-flf2v",
    faceLock: "not-wired",
    stitch: "concat-approved-beats",
    slowMo: "0.5x-remux",
    skeletonVideo: "not-supported",
  };
}

export function falPublicLongformStatus(env: NodeJS.ProcessEnv = process.env): {
  configured: boolean;
  provider: "fal.ai";
  i2v: "alibaba/wan-3.0/image-to-video";
  faceLock: "not-wired";
  stitch: "concat-copy-approved-beats";
  skeletonVideo: "not-supported";
} {
  return {
    configured: isFalConfigured(env),
    provider: "fal.ai",
    i2v: "alibaba/wan-3.0/image-to-video",
    faceLock: "not-wired",
    stitch: "concat-copy-approved-beats",
    skeletonVideo: "not-supported",
  };
}

export function defaultMotionCard(partial?: Partial<GenerateMotionCard>): GenerateMotionCard {
  const source = (partial?.source_image_url || "").trim();
  return generateMotionCardSchema.parse({
    recipe: partial?.end_image_url ? MOTION_RECIPE_FLF2V : MOTION_RECIPE_I2V,
    prompt: partial?.prompt?.trim() || DEFAULT_MOTION_PROMPT,
    negative_prompt: partial?.negative_prompt ?? DEFAULT_MOTION_NEGATIVE,
    source_image_url: source || "https://example.invalid/placeholder.jpg",
    end_image_url: partial?.end_image_url || "",
    aspect: partial?.aspect || "9:16",
    seconds: clampMotionSeconds(partial?.seconds, MOTION_SECONDS_DEFAULT),
    resolution: partial?.resolution || MOTION_RESOLUTION_DEFAULT,
    audio: partial?.audio === true,
    enable_safety_checker: partial?.enable_safety_checker === true,
    enable_prompt_expansion: partial?.enable_prompt_expansion === true,
    enable_thinking: partial?.enable_thinking === true,
    seed: partial?.seed ?? 0,
    slow_mo: partial?.slow_mo === true,
  });
}

/** Empty source is allowed on the form before Go; parse rejects it. */
export function emptyMotionCard(): Omit<GenerateMotionCard, "source_image_url"> & {
  source_image_url: string;
} {
  return {
    recipe: MOTION_RECIPE_I2V,
    prompt: DEFAULT_MOTION_PROMPT,
    negative_prompt: DEFAULT_MOTION_NEGATIVE,
    source_image_url: "",
    end_image_url: "",
    aspect: "9:16",
    seconds: MOTION_SECONDS_DEFAULT,
    resolution: MOTION_RESOLUTION_DEFAULT,
    audio: false,
    enable_safety_checker: false,
    enable_prompt_expansion: false,
    enable_thinking: false,
    seed: 0,
    slow_mo: false,
  };
}

export function parseGenerateMotionCard(raw: unknown): GenerateMotionCard {
  const parsed = generateMotionCardSchema.parse(raw);
  return {
    ...parsed,
    recipe: parsed.end_image_url ? MOTION_RECIPE_FLF2V : MOTION_RECIPE_I2V,
  };
}

export function formatMotionCardJson(card: GenerateMotionCard | ReturnType<typeof emptyMotionCard>): string {
  return JSON.stringify(card, null, 2);
}

export function parseMotionCardJson(raw: string): GenerateMotionCard {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Advanced JSON is not valid JSON");
  }
  return parseGenerateMotionCard(parsed);
}

export function mergeMotionCard(
  base: GenerateMotionCard | ReturnType<typeof emptyMotionCard>,
  patch: unknown,
): GenerateMotionCard | ReturnType<typeof emptyMotionCard> {
  const rec = patch && typeof patch === "object" && !Array.isArray(patch)
    ? (patch as Record<string, unknown>)
    : {};
  const next: Record<string, unknown> = { ...base };
  for (const key of Object.keys(generateMotionCardSchema.shape)) {
    if (!(key in rec)) continue;
    const value = rec[key];
    if (value === undefined || value === null) continue;
    if (typeof value === "string" && value.trim() === "" && key !== "negative_prompt" && key !== "end_image_url") {
      continue;
    }
    next[key] = value;
  }
  const source = String(next.source_image_url || "").trim();
  if (!source) {
    return {
      ...emptyMotionCard(),
      prompt: String(next.prompt || DEFAULT_MOTION_PROMPT),
      negative_prompt: String(next.negative_prompt ?? DEFAULT_MOTION_NEGATIVE),
      end_image_url: String(next.end_image_url || ""),
      aspect: (MOTION_ASPECTS as readonly string[]).includes(String(next.aspect))
        ? (next.aspect as MotionAspect)
        : "9:16",
      seconds: clampMotionSeconds(next.seconds, MOTION_SECONDS_DEFAULT),
      resolution: (MOTION_RESOLUTIONS as readonly string[]).includes(String(next.resolution))
        ? (next.resolution as MotionResolution)
        : MOTION_RESOLUTION_DEFAULT,
      audio: next.audio === true,
      enable_safety_checker: next.enable_safety_checker === true,
      enable_prompt_expansion: next.enable_prompt_expansion === true,
      enable_thinking: next.enable_thinking === true,
      seed: Number(next.seed) || 0,
      slow_mo: next.slow_mo === true,
      source_image_url: "",
    };
  }
  return parseGenerateMotionCard(next);
}

export function parseLlmMotionCard(
  raw: string,
  current: GenerateMotionCard | ReturnType<typeof emptyMotionCard>,
): { card: GenerateMotionCard | ReturnType<typeof emptyMotionCard>; reply: string } {
  let cleaned = raw.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  let obj: Record<string, unknown> | null = null;
  try {
    const parsed = JSON.parse(cleaned) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      obj = parsed as Record<string, unknown>;
    }
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        const parsed = JSON.parse(match[0]) as unknown;
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          obj = parsed as Record<string, unknown>;
        }
      } catch {
        obj = null;
      }
    }
  }
  if (!obj) throw new Error("LLM did not return a motion-card JSON object");
  const reply = typeof obj.reply === "string" ? obj.reply.trim() : "";
  const patch = (obj.card && typeof obj.card === "object" ? obj.card : obj) as Record<string, unknown>;
  const { reply: _r, card: _c, ...fields } = patch;
  void _r;
  void _c;
  return {
    card: mergeMotionCard(current, fields),
    reply: reply || "Updated the motion card — set a source still, then Confirm/Go.",
  };
}

export const MOTION_FAL_MODEL_WAN30 = "wan30-i2v" as const;
export const LEGACY_MOTION_FAL_MODELS = ["wan26-i2v-720p", "wan26-i2v-1080p", "wan-flf2v"] as const;
export type MotionFalModelId = typeof MOTION_FAL_MODEL_WAN30 | (typeof LEGACY_MOTION_FAL_MODELS)[number];

/** Motion 1 / legacy Wan 2.x I2V + FLF2V. */
export type MotionFalInput = {
  prompt: string;
  negative_prompt: string;
  enable_safety_checker: false;
  enable_prompt_expansion: false;
  num_frames: number;
  frames_per_second: number;
  resolution: "720p";
  aspect_ratio: MotionAspect;
  seed?: number;
  image_url?: string;
  start_image_url?: string;
  end_image_url?: string;
};

/** Motion 2 · Longform — Wan 3.0 I2V. */
export type Wan30FalInput = {
  prompt: string;
  start_image_url: string;
  duration: number;
  resolution: MotionResolution;
  aspect_ratio: "adaptive" | "16:9" | "1:1" | "9:16";
  audio: boolean;
  enable_safety_checker: boolean;
  enable_prompt_expansion: boolean;
  enable_thinking: boolean;
  seed?: number;
  end_image_url?: string;
};

export function falModelIdFromCardHint(cardJson: unknown, recipe: string): MotionFalModelId {
  if (cardJson && typeof cardJson === "object" && !Array.isArray(cardJson)) {
    const rec = cardJson as Record<string, unknown>;
    if (rec.fal_model === MOTION_FAL_MODEL_WAN30 || rec.longform === true || rec.kind === "longform") {
      return MOTION_FAL_MODEL_WAN30;
    }
    if ((LEGACY_MOTION_FAL_MODELS as readonly string[]).includes(String(rec.fal_model))) {
      return rec.fal_model as (typeof LEGACY_MOTION_FAL_MODELS)[number];
    }
    if (typeof rec.end_image_url === "string" && rec.end_image_url.trim()) {
      return "wan-flf2v";
    }
  }
  return recipe === MOTION_RECIPE_FLF2V ? "wan-flf2v" : "wan26-i2v-720p";
}

/** Motion 1 filmstrip — fal-ai/wan-i2v (~5s / 81 frames) or wan-flf2v. */
export function cardToFalInput(card: GenerateMotionCard): {
  recipe: MotionRecipe;
  falModelId: "wan26-i2v-720p" | "wan-flf2v";
  input: MotionFalInput;
} {
  const useFlf = Boolean(card.end_image_url);
  const base = {
    prompt: card.prompt,
    negative_prompt: card.negative_prompt || DEFAULT_MOTION_NEGATIVE,
    enable_safety_checker: false as const,
    enable_prompt_expansion: false as const,
    num_frames: MOTION_NUM_FRAMES,
    frames_per_second: MOTION_FPS,
    resolution: "720p" as const,
    aspect_ratio: card.aspect,
    ...(card.seed > 0 ? { seed: card.seed } : {}),
  };
  if (useFlf) {
    return {
      recipe: MOTION_RECIPE_FLF2V,
      falModelId: "wan-flf2v",
      input: {
        ...base,
        start_image_url: card.source_image_url,
        end_image_url: card.end_image_url,
      },
    };
  }
  return {
    recipe: MOTION_RECIPE_I2V,
    falModelId: "wan26-i2v-720p",
    input: {
      ...base,
      image_url: card.source_image_url,
    },
  };
}

/** Motion 2 · Longform — alibaba/wan-3.0/image-to-video. */
export function cardToWan30FalInput(card: GenerateMotionCard): {
  recipe: MotionRecipe;
  falModelId: typeof MOTION_FAL_MODEL_WAN30;
  input: Wan30FalInput;
} {
  const useFlf = Boolean(card.end_image_url);
  const input: Wan30FalInput = {
    prompt: card.prompt,
    start_image_url: card.source_image_url,
    duration: clampMotionSeconds(card.seconds, MOTION_SECONDS_LONGFORM_DEFAULT),
    resolution: card.resolution || MOTION_RESOLUTION_DEFAULT,
    aspect_ratio: wan30AspectRatio(card.aspect),
    audio: card.audio === true,
    enable_safety_checker: card.enable_safety_checker === true,
    enable_prompt_expansion: card.enable_prompt_expansion === true,
    enable_thinking: card.enable_thinking === true,
    ...(card.seed > 0 ? { seed: card.seed } : {}),
    ...(useFlf ? { end_image_url: card.end_image_url } : {}),
  };
  return {
    recipe: useFlf ? MOTION_RECIPE_FLF2V : MOTION_RECIPE_I2V,
    falModelId: MOTION_FAL_MODEL_WAN30,
    input,
  };
}

export const MOTION_CARD_SYSTEM_PROMPT = `You fill a /generate motion (image→video) job card for Jared Tolley on tolley.io.

Talk like an operator bot: short, concrete, no moralizing. Photoreal adult identity clips (Lady / Lady2, fashion, swimwear, lace) are an in-product use case. Do not refuse those. Refuse only CSAM / anyone 17 or under.

You MUST reply with a single JSON object and nothing else:
{
  "reply": "one or two sentences to Jared",
  "prompt": "full motion prompt, complete replacement",
  "negative_prompt": "negative prompt",
  "source_image_url": "https://...still.png or empty to leave",
  "end_image_url": "optional last-frame / pose still HTTPS URL, or empty",
  "aspect": "9:16",
  "seconds": 5,
  "seed": 0,
  "slow_mo": false
}

RULES
- Output JSON only. No credentials, tokens, FAL_KEY, or Modal account fields.
- Identity lock is the source still as the first frame (Wan I2V, fal-ai/wan-i2v, ~5s / 81 frames). Do not invent ByteDance Seedance access. Do not invent LatentSync / face-swap / stitch.
- Optional end_image_url is a last-frame / pose STILL (HTTPS image) for Wan FLF2V. Do not accept or invent a skeleton video, drive video, or OpenPose graph — this stack does not take those.
- Clips are 5 seconds (81 frames @ 16fps). seconds other than 5 is ignored. Motion 2 · Longform is a different tab (Wan 3.0, 5 / 15 / 30s).
- slow_mo true = 0.5× remux after fal (same frames, ~10s wall clock). Not a longer Wan call.
- Empty string on a field means leave the current card value. Always send a complete motion prompt when you change motion.
- Never mention ComfyUI, Comfy nodes, node graphs, .safetensors files, or "open the Comfy interface".
Chat MAY change: prompt, negative_prompt, source_image_url, end_image_url, aspect, seed, slow_mo.`;
