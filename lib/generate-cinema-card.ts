/**
 * Cinema fal request bodies — Seedance 2.0 reference-to-video + Kling 3 Pro
 * elements. Dry-run / tests inspect these kwargs; no GPU spend here.
 */

import {
  CINEMA_CHILD_KLING,
  CINEMA_CHILD_SEEDANCE,
  CINEMA_SECONDS_DEFAULT,
  clampCinemaSeconds,
  type CinemaModel,
  type CinemaQueue,
} from "./generate-cinema";
import { DEFAULT_MOTION_NEGATIVE } from "./generate-motion-card";

export const CINEMA_FAL_SEEDANCE = "seedance-ref" as const;
export const CINEMA_FAL_KLING = "kling3-elements" as const;
export const SEEDANCE_ENDPOINT = "bytedance/seedance-2.0/reference-to-video";
export const KLING3_ENDPOINT = "fal-ai/kling-video/v3/pro/image-to-video";

export type SeedanceRefInput = {
  prompt: string;
  image_urls: string[];
  video_urls?: string[];
  audio_urls?: string[];
  aspect_ratio: "9:16" | "16:9" | "1:1" | "auto";
  resolution: "480p" | "720p" | "1080p";
  duration: string;
  generate_audio: boolean;
};

export type Kling3Element = {
  frontal_image_url: string;
  reference_image_urls?: string[];
  video_url?: string;
};

export type Kling3ElementsInput = {
  prompt: string;
  start_image_url: string;
  duration: string;
  generate_audio: boolean;
  elements: Kling3Element[];
  shot_type: "customize";
  negative_prompt: string;
};

export function cinemaFalModelId(model: CinemaModel): typeof CINEMA_FAL_SEEDANCE | typeof CINEMA_FAL_KLING {
  return model === "kling" ? CINEMA_FAL_KLING : CINEMA_FAL_SEEDANCE;
}

export function cinemaChildRecipe(model: CinemaModel): typeof CINEMA_CHILD_SEEDANCE | typeof CINEMA_CHILD_KLING {
  return model === "kling" ? CINEMA_CHILD_KLING : CINEMA_CHILD_SEEDANCE;
}

export function klingPromptFromSeedance(prompt: string): string {
  return (prompt || "")
    .replace(/@Image1\b/gi, "@Element1")
    .replace(/@Image2\b/gi, "@Element1")
    .replace(/@Image3\b/gi, "@Element1")
    .replace(/@Audio1\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function seedanceRefInput(opts: {
  prompt: string;
  imageUrls: string[];
  videoUrls?: string[];
  audioUrls?: string[];
  seconds?: unknown;
  generateAudio?: boolean;
  aspect?: "9:16" | "16:9" | "1:1" | "auto";
  resolution?: "480p" | "720p" | "1080p";
}): SeedanceRefInput {
  const image_urls = (opts.imageUrls || []).map((u) => u.trim()).filter(Boolean).slice(0, 9);
  const video_urls = (opts.videoUrls || []).map((u) => u.trim()).filter(Boolean).slice(0, 3);
  const audio_urls = (opts.audioUrls || []).map((u) => u.trim()).filter(Boolean).slice(0, 3);
  const input: SeedanceRefInput = {
    prompt: (opts.prompt || "").trim(),
    image_urls,
    aspect_ratio: opts.aspect || "9:16",
    resolution: opts.resolution || "720p",
    duration: String(clampCinemaSeconds(opts.seconds, CINEMA_SECONDS_DEFAULT)),
    generate_audio: opts.generateAudio !== false,
  };
  if (video_urls.length) input.video_urls = video_urls;
  if (audio_urls.length) input.audio_urls = audio_urls;
  return input;
}

export function kling3ElementsInput(opts: {
  prompt: string;
  imageUrls: string[];
  seconds?: unknown;
  generateAudio?: boolean;
  negativePrompt?: string;
}): Kling3ElementsInput {
  const images = (opts.imageUrls || []).map((u) => u.trim()).filter(Boolean).slice(0, 9);
  const start = images[0] || "";
  const frontal = images[1] || images[0] || "";
  const refs = images.slice(images[1] ? 2 : 1).slice(0, 3);
  const element: Kling3Element = { frontal_image_url: frontal };
  if (refs.length) element.reference_image_urls = refs;
  return {
    prompt: klingPromptFromSeedance(opts.prompt),
    start_image_url: start,
    duration: String(clampCinemaSeconds(opts.seconds, CINEMA_SECONDS_DEFAULT)),
    generate_audio: opts.generateAudio !== false,
    elements: [{ ...element }],
    shot_type: "customize",
    negative_prompt: (opts.negativePrompt || DEFAULT_MOTION_NEGATIVE).trim() || DEFAULT_MOTION_NEGATIVE,
  };
}

export function cinemaSpawnInput(
  queue: CinemaQueue,
  beat: { prompt: string; seconds: number; generate_audio: boolean; video_ref_url?: string; negative_prompt?: string },
): {
  model: CinemaModel;
  falModelId: typeof CINEMA_FAL_SEEDANCE | typeof CINEMA_FAL_KLING;
  recipe: typeof CINEMA_CHILD_SEEDANCE | typeof CINEMA_CHILD_KLING;
  input: SeedanceRefInput | Kling3ElementsInput;
} {
  const videoUrls = [beat.video_ref_url, queue.prior_video_url].filter((u): u is string => Boolean(u && u.trim()));
  const audioUrls = queue.audio_url.trim() ? [queue.audio_url.trim()] : [];
  if (queue.model === "kling") {
    return {
      model: "kling",
      falModelId: CINEMA_FAL_KLING,
      recipe: CINEMA_CHILD_KLING,
      input: kling3ElementsInput({
        prompt: beat.prompt,
        imageUrls: queue.image_urls,
        seconds: beat.seconds,
        generateAudio: beat.generate_audio,
        negativePrompt: beat.negative_prompt,
      }),
    };
  }
  return {
    model: "seedance",
    falModelId: CINEMA_FAL_SEEDANCE,
    recipe: CINEMA_CHILD_SEEDANCE,
    input: seedanceRefInput({
      prompt: beat.prompt,
      imageUrls: queue.image_urls,
      videoUrls,
      audioUrls,
      seconds: beat.seconds,
      generateAudio: beat.generate_audio,
      aspect: queue.aspect,
      resolution: queue.resolution === "1080p" || queue.resolution === "480p" ? queue.resolution : "720p",
    }),
  };
}

export function falPublicCinemaStatus(env: NodeJS.ProcessEnv = process.env): {
  configured: boolean;
  provider: "fal.ai";
  seedance: typeof SEEDANCE_ENDPOINT;
  kling: typeof KLING3_ENDPOINT;
  stitch: "concat-copy-approved-beats";
  qa: "spark-only";
} {
  return {
    configured: Boolean((env.FAL_KEY || "").trim()),
    provider: "fal.ai",
    seedance: SEEDANCE_ENDPOINT,
    kling: KLING3_ENDPOINT,
    stitch: "concat-copy-approved-beats",
    qa: "spark-only",
  };
}
