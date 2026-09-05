/**
 * Server-side fal.ai motion (I2V / FLF2V) for /generate.
 *
 * FAL_KEY stays in Vercel env. Never import this from a client component
 * and never echo the key in API responses.
 */

import { fal } from "@fal-ai/client";

import { persistVideoToBlob } from "./blob";
import { parseGatedJobImagePath } from "./generate-output";
import { fetchStoredJobImage } from "./generate-output-persist";
import { prisma } from "./prisma";
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

async function bodyToBuffer(body: ReadableStream<Uint8Array> | Buffer): Promise<Buffer> {
  if (Buffer.isBuffer(body)) return body;
  const reader = body.getReader();
  const chunks: Buffer[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks);
}

/** Turn an HQ-gated gallery still into an HTTPS URL fal can fetch (fal storage, 1 day). */
export async function resolveMotionStillForFal(url: string): Promise<string> {
  const gated = parseGatedJobImagePath(url);
  if (!gated) return url;
  const row = await prisma.generateJob.findUnique({ where: { id: gated.jobId } });
  const stored = row?.outputUrls[gated.index];
  if (!stored) {
    throw new Error("Source still not found. Finish a Modal still first, or paste an HTTPS URL.");
  }
  const image = await fetchStoredJobImage(gated.jobId, stored);
  const buf = await bodyToBuffer(image.body);
  const file = new File([new Uint8Array(buf)], `${gated.jobId}-${gated.index}.png`, {
    type: image.contentType || "image/png",
  });
  return fal.storage.upload(file, { lifecycle: { expiresIn: "1d" } });
}

export async function spawnFalMotion(
  card: GenerateMotionCard,
): Promise<{ callId: string; recipe: typeof MOTION_RECIPE_I2V | typeof MOTION_RECIPE_FLF2V; falModelId: FalModelId }> {
  if (!isFalConfigured()) {
    throw new Error("fal.ai is not configured. Set FAL_KEY on Vercel.");
  }
  const resolved: GenerateMotionCard = {
    ...card,
    source_image_url: await resolveMotionStillForFal(card.source_image_url),
    end_image_url: card.end_image_url
      ? await resolveMotionStillForFal(card.end_image_url)
      : card.end_image_url,
  };
  const planned = cardToFalInput(resolved);
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
