/**
 * Structured /generate motion card — identity-locked image→video.
 *
 * Stack (already on Jared's fal.ai account; no ByteDance Seedance claim):
 *   - fal-ai/wan-i2v        first-frame I2V (~5s @ 16fps / 81 frames)
 *   - fal-ai/wan-flf2v      first+last frame when a pose / end still is set
 *
 * Identity is the source still as frame 1. LatentSync face-lock and beat
 * stitch are not wired. Skeleton *video* drive is not supported — only an
 * optional last-frame / pose *still* (HTTPS image).
 */

import { z } from "zod";

export const MOTION_RECIPE_I2V = "fal-wan-i2v" as const;
export const MOTION_RECIPE_FLF2V = "fal-wan-flf2v" as const;
export const MOTION_RECIPES = [MOTION_RECIPE_I2V, MOTION_RECIPE_FLF2V] as const;
export type MotionRecipe = (typeof MOTION_RECIPES)[number];

export const MOTION_SECONDS_DEFAULT = 5;
export const MOTION_SECONDS_MAX = 5;
export const MOTION_NUM_FRAMES = 81;
export const MOTION_FPS = 16;

export const MOTION_ASPECTS = ["9:16", "16:9", "1:1", "auto"] as const;
export type MotionAspect = (typeof MOTION_ASPECTS)[number];

export const DEFAULT_MOTION_PROMPT = [
  "The same adult woman as the first-frame still.",
  "Keep her exact face, bone structure, skin, hair, and age. Do not invent a different person.",
  "Soft natural motion: she breathes, a slight smile, hair and fabric move in a gentle breeze.",
  "Photoreal, identity locked to the first frame. Camera holds. No cut, no morph.",
].join(" ");

export const DEFAULT_MOTION_NEGATIVE =
  "different person, identity drift, deformed face, extra limbs, child, minor, blurry, lowres, watermark, text, cartoon, illustration, still image, morph";

const httpsUrl = z
  .string()
  .trim()
  .max(2000)
  .refine((u) => /^https:\/\//i.test(u), "Must be an HTTPS URL");

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
  .refine((u) => !u || /^https:\/\//i.test(u), "Must be an HTTPS URL");

export const generateMotionCardSchema = z.object({
  recipe: z.enum(MOTION_RECIPES).default(MOTION_RECIPE_I2V),
  prompt: z.string().trim().min(1).max(5000),
  negative_prompt: z.string().max(2000).default(DEFAULT_MOTION_NEGATIVE),
  source_image_url: httpsUrl,
  end_image_url: optionalHttpsUrl,
  aspect: z.enum(MOTION_ASPECTS).default("9:16"),
  seconds: z.coerce.number().min(2).max(MOTION_SECONDS_MAX).default(MOTION_SECONDS_DEFAULT),
  seed: z.coerce.number().int().min(0).max(2_147_483_647).default(0),
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
  stitch: "not-wired";
  skeletonVideo: "not-supported";
} {
  return {
    configured: isFalConfigured(env),
    provider: "fal.ai",
    i2v: "fal-ai/wan-i2v",
    flf2v: "fal-ai/wan-flf2v",
    faceLock: "not-wired",
    stitch: "not-wired",
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
    seconds: partial?.seconds ?? MOTION_SECONDS_DEFAULT,
    seed: partial?.seed ?? 0,
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
    seed: 0,
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
      seconds: Number(next.seconds) || MOTION_SECONDS_DEFAULT,
      seed: Number(next.seed) || 0,
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

export function falModelIdFromCardHint(
  cardJson: unknown,
  recipe: string,
): "wan26-i2v-720p" | "wan-flf2v" {
  if (cardJson && typeof cardJson === "object" && !Array.isArray(cardJson)) {
    const rec = cardJson as Record<string, unknown>;
    if (rec.fal_model === "wan-flf2v" || rec.fal_model === "wan26-i2v-720p") {
      return rec.fal_model;
    }
    if (typeof rec.end_image_url === "string" && rec.end_image_url.trim()) {
      return "wan-flf2v";
    }
  }
  return recipe === MOTION_RECIPE_FLF2V ? "wan-flf2v" : "wan26-i2v-720p";
}

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
  "seed": 0
}

RULES
- Output JSON only. No credentials, tokens, FAL_KEY, or Modal account fields.
- Identity lock is the source still as the first frame (Wan I2V). Do not invent ByteDance Seedance access. Do not invent LatentSync / face-swap / stitch.
- Optional end_image_url is a last-frame / pose STILL (HTTPS image) for Wan FLF2V. Do not accept or invent a skeleton video, drive video, or OpenPose graph — this stack does not take those.
- Clips are 5 seconds (81 frames @ 16fps). seconds other than 5 is ignored.
- Empty string on a field means leave the current card value. Always send a complete motion prompt when you change motion.
- Never mention ComfyUI, Comfy nodes, node graphs, .safetensors files, or "open the Comfy interface".
Chat MAY change: prompt, negative_prompt, source_image_url, end_image_url, aspect, seed.`;
