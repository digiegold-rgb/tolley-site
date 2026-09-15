/**
 * Structured /generate engine cards for the fal T2I / T2V tabs.
 *
 * I2V reuses the Motion card (Wan I2V). V2V is not wired — the UI disables it.
 */

import { z } from "zod";
import { FLUX_PIXELS } from "./generate-cost";

import { MOTION_RECIPE_FLF2V, MOTION_RECIPE_I2V } from "./generate-motion-card";

export const ENGINE_RECIPE_T2I = "fal-flux-t2i" as const;
export const ENGINE_RECIPE_T2V = "fal-wan-t2v" as const;

export const ENGINE_ASPECTS = ["9:16", "16:9", "1:1"] as const;
export type EngineAspect = (typeof ENGINE_ASPECTS)[number];

export const ENGINE_SECONDS_DEFAULT = 5;
export const ENGINE_SECONDS_MAX = 5;

export const ENGINE_IMAGE_MODELS = ["flux-dev", "flux-schnell"] as const;
export const ENGINE_VIDEO_MODELS = ["wan26-720p", "wan30-t2v"] as const;

export const FLUX_IMAGE_SIZE = {
  "9:16": "portrait_16_9",
  "16:9": "landscape_16_9",
  "1:1": "square_hd",
} as const;

const DEFAULT_T2I_NEGATIVE =
  "child, minor, deformed face, extra limbs, blurry, lowres, watermark, text, cartoon, illustration";
const DEFAULT_T2V_NEGATIVE =
  "child, minor, deformed face, extra limbs, blurry, lowres, watermark, text, cartoon, still image, morph";

export function isFalImageRecipe(recipe: string | null | undefined): boolean {
  return recipe === ENGINE_RECIPE_T2I || recipe === "fal-qwen-edit" || recipe === "fal-flux2-edit";
}

export function isFalVideoRecipe(recipe: string | null | undefined): boolean {
  return (
    recipe === ENGINE_RECIPE_T2V ||
    recipe === MOTION_RECIPE_I2V ||
    recipe === MOTION_RECIPE_FLF2V ||
    recipe === "fal-seedance-ref" ||
    recipe === "fal-kling-elements"
  );
}

export function isEngineRecipe(recipe: string | null | undefined): boolean {
  return recipe === ENGINE_RECIPE_T2I || recipe === ENGINE_RECIPE_T2V;
}

/** Wan wants 4n+1 frames. Cap at 81 (~5s @ 16fps). */
export function wanFramesForSeconds(seconds: number): number {
  const s = Number(seconds);
  if (!Number.isFinite(s) || s >= 4.75) return 81;
  if (s <= 2.25) return 33;
  if (s <= 3.25) return 49;
  return 65;
}

export const generateEngineCardSchema = z.object({
  recipe: z.enum([ENGINE_RECIPE_T2I, ENGINE_RECIPE_T2V]).default(ENGINE_RECIPE_T2I),
  prompt: z.string().trim().min(1).max(8000),
  negative_prompt: z.string().max(2000).default(""),
  aspect: z.enum(ENGINE_ASPECTS).default("9:16"),
  seconds: z.coerce.number().min(2).max(ENGINE_SECONDS_MAX).default(ENGINE_SECONDS_DEFAULT),
  seed: z.coerce.number().int().min(0).max(2_147_483_647).default(0),
  slow_mo: z.boolean().default(false),
  model: z.enum([...ENGINE_IMAGE_MODELS, ...ENGINE_VIDEO_MODELS]).optional(),
});

export type GenerateEngineCard = z.infer<typeof generateEngineCardSchema>;

export function parseGenerateEngineCard(
  raw: unknown,
  kind: "t2i" | "t2v" = "t2i",
): GenerateEngineCard {
  const rec = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const parsed = generateEngineCardSchema.parse({
    ...rec,
    recipe: kind === "t2v" ? ENGINE_RECIPE_T2V : ENGINE_RECIPE_T2I,
    negative_prompt:
      typeof rec.negative_prompt === "string" && rec.negative_prompt.trim()
        ? rec.negative_prompt
        : kind === "t2v"
          ? DEFAULT_T2V_NEGATIVE
          : DEFAULT_T2I_NEGATIVE,
  });
  const allowed: readonly string[] = kind === "t2i" ? ENGINE_IMAGE_MODELS : ENGINE_VIDEO_MODELS;
  if (parsed.model && !allowed.includes(parsed.model)) throw new Error("Model is incompatible with this workflow");
  return parsed;
}

export function cardToFalT2IInput(card: GenerateEngineCard): {
  recipe: typeof ENGINE_RECIPE_T2I;
  falModelId: "flux-dev" | "flux-schnell";
  input: {
    prompt: string;
    image_size: { width: number; height: number };
    enable_safety_checker: false;
    num_images: 1;
    output_format: "png";
    seed?: number;
  };
} {
  return {
    recipe: ENGINE_RECIPE_T2I,
    falModelId: card.model === "flux-schnell" ? "flux-schnell" : "flux-dev",
    input: {
      prompt: card.prompt,
      image_size: FLUX_PIXELS[card.aspect],
      enable_safety_checker: false,
      num_images: 1,
      output_format: "png",
      ...(card.seed > 0 ? { seed: card.seed } : {}),
    },
  };
}

export function cardToFalT2VInput(card: GenerateEngineCard): {
  recipe: typeof ENGINE_RECIPE_T2V;
  falModelId: "wan26-720p" | "wan30-t2v";
  input: {
    prompt: string;
    negative_prompt?: string;
    enable_safety_checker: false;
    enable_prompt_expansion: false;
    num_frames?: number;
    frames_per_second?: 16;
    duration?: number;
    audio?: boolean;
    enable_thinking?: boolean;
    resolution: "720p";
    aspect_ratio: EngineAspect;
    seed?: number;
  };
} {
  if (card.model === "wan30-t2v") return {
    recipe: ENGINE_RECIPE_T2V,
    falModelId: "wan30-t2v",
    input: {
      prompt: card.prompt, duration: Math.round(card.seconds), resolution: "720p",
      aspect_ratio: card.aspect, audio: false, enable_thinking: false,
      enable_safety_checker: false, enable_prompt_expansion: false,
      ...(card.seed > 0 ? { seed: card.seed } : {}),
    },
  };
  return {
    recipe: ENGINE_RECIPE_T2V,
    falModelId: "wan26-720p",
    input: {
      prompt: card.prompt,
      negative_prompt: card.negative_prompt || DEFAULT_T2V_NEGATIVE,
      enable_safety_checker: false,
      enable_prompt_expansion: false,
      num_frames: wanFramesForSeconds(card.seconds),
      frames_per_second: 16,
      resolution: "720p",
      aspect_ratio: card.aspect,
      ...(card.seed > 0 ? { seed: card.seed } : {}),
    },
  };
}

export function falEnginePublicStatus(env: NodeJS.ProcessEnv = process.env): {
  configured: boolean;
  provider: "fal.ai";
  t2i: "fal-ai/flux/dev";
  t2v: "fal-ai/wan-t2v";
  i2v: "fal-ai/wan-i2v";
  v2v: "not-wired";
} {
  return {
    configured: Boolean((env.FAL_KEY || "").trim()),
    provider: "fal.ai",
    t2i: "fal-ai/flux/dev",
    t2v: "fal-ai/wan-t2v",
    i2v: "fal-ai/wan-i2v",
    v2v: "not-wired",
  };
}
