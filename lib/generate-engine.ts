/**
 * Server-side fal.ai T2I (FLUX.1 [dev]) + T2V (Wan) for /generate engine tabs.
 * I2V reuses generate-motion. V2V is not wired.
 */

import {
  checkImageStatus,
  formatFalError,
  formatFalFailure,
  getImageResult,
  submitImageGeneration,
  submitVideoGeneration,
  type FalImageModelId,
  type FalModelId,
} from "./fal";
import {
  ENGINE_RECIPE_T2I,
  ENGINE_RECIPE_T2V,
  cardToFalT2IInput,
  cardToFalT2VInput,
  isFalImageRecipe,
  isFalVideoRecipe,
  type GenerateEngineCard,
} from "./generate-engine-card";
import { isFalConfigured } from "./generate-motion";
import { persistJobPngs } from "./generate-output-persist";

export {
  ENGINE_RECIPE_T2I,
  ENGINE_RECIPE_T2V,
  isFalImageRecipe,
  isFalVideoRecipe,
};

export function spawnT2IInput(card: GenerateEngineCard) {
  return cardToFalT2IInput(card);
}

export function spawnT2VInput(card: GenerateEngineCard) {
  return cardToFalT2VInput(card);
}

export async function spawnFalT2I(
  card: GenerateEngineCard,
): Promise<{ callId: string; recipe: typeof ENGINE_RECIPE_T2I; falModelId: FalImageModelId }> {
  if (!isFalConfigured()) {
    throw new Error("fal.ai is not configured. Set FAL_KEY on Vercel.");
  }
  const planned = cardToFalT2IInput(card);
  const { requestId } = await submitImageGeneration(planned.falModelId, planned.input.prompt, {
    ...planned.input,
  });
  return { callId: requestId, recipe: planned.recipe, falModelId: planned.falModelId };
}

export async function spawnFalT2V(
  card: GenerateEngineCard,
): Promise<{ callId: string; recipe: typeof ENGINE_RECIPE_T2V; falModelId: FalModelId }> {
  if (!isFalConfigured()) {
    throw new Error("fal.ai is not configured. Set FAL_KEY on Vercel.");
  }
  const planned = cardToFalT2VInput(card);
  const { requestId } = await submitVideoGeneration(planned.falModelId, planned.input.prompt, {
    ...planned.input,
  });
  return { callId: requestId, recipe: planned.recipe, falModelId: planned.falModelId };
}

export async function pollFalImage(
  falModelId: FalImageModelId,
  requestId: string,
): Promise<
  | { pending: true; status: "IN_QUEUE" | "IN_PROGRESS" }
  | { done: true; imageUrl: string; imageUrls: string[]; contentType?: string }
  | { failed: true; error: string }
> {
  const status = await checkImageStatus(falModelId, requestId);
  if (status.status === "IN_QUEUE" || status.status === "IN_PROGRESS") {
    return { pending: true, status: status.status };
  }
  if (status.status === "FAILED") {
    return { failed: true, error: formatFalFailure(status) };
  }
  try {
    const result = await getImageResult(falModelId, requestId);
    return { done: true, imageUrl: result.imageUrl, imageUrls: result.imageUrls, contentType: result.contentType };
  } catch (err) {
    return { failed: true, error: formatFalError(err, "fal flux result failed") };
  }
}

/**
 * Persist a fal still to Spark / private Blob. Falls back to the fal HTTPS URL
 * (proxied by the gated job route) — never a public Vercel Blob object.
 */
export async function persistFalStill(jobId: string, imageUrl: string): Promise<string> {
  try {
    const res = await fetch(imageUrl, { cache: "no-store" });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} fetching fal still`);
    }
    const buf = Buffer.from(await res.arrayBuffer());
    if (!buf.length) throw new Error("empty fal still");
    const refs = await persistJobPngs(jobId, [buf.toString("base64")]);
    if (refs[0]) return refs[0];
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.warn(`[generate-engine] Spark/private persist failed for ${jobId}: ${detail}`);
  }
  return imageUrl;
}

export function falT2VModelId(card?: unknown): FalModelId {
  return (card as { fal_model?: string } | null)?.fal_model === "wan30-t2v" ? "wan30-t2v" : "wan26-720p";
}

export function falT2IModelId(card?: unknown): FalImageModelId {
  const id = (card as { fal_model?: string } | null)?.fal_model;
  return id === "qwen-edit" || id === "flux2-edit" || id === "flux-schnell" ? id : "flux-dev";
}

/** Persist a whole batch together, preserving distinct output indexes. */
export async function persistFalStills(jobId: string, urls: string[]): Promise<string[]> {
  try {
    const pngs = await Promise.all(urls.map(async url => {
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) throw new Error(`Image download failed (${response.status})`);
      const bytes = Buffer.from(await response.arrayBuffer());
      if (!bytes.length) throw new Error("Empty image response");
      return bytes.toString("base64");
    }));
    const stored = await persistJobPngs(jobId, pngs);
    if (stored.length === urls.length) return stored;
  } catch (error) { console.warn(`[generate-engine] Batch persistence failed for ${jobId}`, error instanceof Error ? error.message : "Unknown error"); }
  return urls;
}
