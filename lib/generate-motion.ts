/**
 * Server-side fal.ai motion (I2V / FLF2V) for /generate.
 *
 * FAL_KEY stays in Vercel env. Never import this from a client component
 * and never echo the key in API responses.
 */

import { persistVideoToBlob } from "./blob";
import {
  FAL_MODELS,
  checkVideoStatus,
  getVideoResult,
  submitVideoGeneration,
  type FalModelId,
} from "./fal";
import {
  MOTION_RECIPE_FLF2V,
  MOTION_RECIPE_I2V,
  cardToFalInput,
  falModelIdFromCardHint,
  falPublicStatus,
  isFalConfigured,
  isMotionRecipe,
  type GenerateMotionCard,
} from "./generate-motion-card";

export { falPublicStatus, isFalConfigured, isMotionRecipe };

export function spawnInputForCard(card: GenerateMotionCard) {
  return cardToFalInput(card);
}

export async function spawnFalMotion(
  card: GenerateMotionCard,
): Promise<{ callId: string; recipe: typeof MOTION_RECIPE_I2V | typeof MOTION_RECIPE_FLF2V; falModelId: FalModelId }> {
  if (!isFalConfigured()) {
    throw new Error("fal.ai is not configured. Set FAL_KEY on Vercel.");
  }
  const planned = cardToFalInput(card);
  const { requestId } = await submitVideoGeneration(planned.falModelId, planned.input.prompt, {
    ...planned.input,
  });
  return { callId: requestId, recipe: planned.recipe, falModelId: planned.falModelId };
}

export async function pollFalMotion(
  falModelId: FalModelId,
  requestId: string,
): Promise<
  | { pending: true; status: "IN_QUEUE" | "IN_PROGRESS" }
  | { done: true; videoUrl: string; contentType?: string }
  | { failed: true; error: string }
> {
  const status = await checkVideoStatus(falModelId, requestId);
  if (status.status === "IN_QUEUE" || status.status === "IN_PROGRESS") {
    return { pending: true, status: status.status };
  }
  if (status.status === "FAILED") {
    return { failed: true, error: status.logs?.slice(-1)[0] || "fal.ai generation failed" };
  }
  const result = await getVideoResult(falModelId, requestId);
  return { done: true, videoUrl: result.videoUrl, contentType: result.contentType };
}

export function falModelIdForRecipe(recipe: string): FalModelId {
  if (recipe === MOTION_RECIPE_FLF2V) return "wan-flf2v";
  return "wan26-i2v-720p";
}

export function falModelIdFromCard(cardJson: unknown, recipe: string): FalModelId {
  return falModelIdFromCardHint(cardJson, recipe);
}

export async function persistMotionVideo(
  jobId: string,
  videoUrl: string,
  contentType?: string,
): Promise<string> {
  try {
    const blob = await persistVideoToBlob(videoUrl, `generate-motion-${jobId}`, contentType);
    return blob || videoUrl;
  } catch {
    return videoUrl;
  }
}

export function assertKnownFalMotionModel(id: string): asserts id is FalModelId {
  if (!(id in FAL_MODELS)) {
    throw new Error(`Unknown fal motion model: ${id}`);
  }
}
