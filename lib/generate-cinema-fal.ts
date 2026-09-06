/**
 * Server-side Cinema spawn (Seedance / Kling). FAL_KEY never leaves the server.
 */

import {
  checkCinemaStatus,
  formatCinemaFalFailure,
  formatFalError,
  formatFalFailure,
  getVideoResult,
  submitKling3Elements,
  submitSeedanceRefToVideo,
} from "./fal";
import { cinemaSpawnInput } from "./generate-cinema-card";
import type { CinemaQueue } from "./generate-cinema";
import { isFalConfigured } from "./generate-motion-card";
import { resolveMotionStillForFal } from "./generate-motion";

export { isFalConfigured };

async function resolveUrlList(urls: string[]): Promise<string[]> {
  const out: string[] = [];
  for (const url of urls) {
    const trimmed = (url || "").trim();
    if (!trimmed) continue;
    out.push(await resolveMotionStillForFal(trimmed));
  }
  return out;
}

export async function spawnCinemaBeat(
  queue: CinemaQueue,
  beat: {
    prompt: string;
    seconds: number;
    generate_audio: boolean;
    video_ref_url?: string;
    negative_prompt?: string;
  },
): Promise<{
  callId: string;
  recipe: "fal-seedance-ref" | "fal-kling-elements";
  falModelId: "seedance-ref" | "kling3-elements";
}> {
  if (!isFalConfigured()) {
    throw new Error("fal.ai is not configured. Set FAL_KEY on Vercel.");
  }
  const planned = cinemaSpawnInput(queue, beat);
  const resolvedImages = await resolveUrlList(queue.image_urls);
  const resolvedVideo = beat.video_ref_url?.trim()
    ? await resolveMotionStillForFal(beat.video_ref_url.trim())
    : queue.prior_video_url.trim()
      ? await resolveMotionStillForFal(queue.prior_video_url.trim())
      : "";
  const resolvedAudio = queue.audio_url.trim() ? await resolveMotionStillForFal(queue.audio_url.trim()) : "";

  const resolvedQueue: CinemaQueue = {
    ...queue,
    image_urls: resolvedImages,
    prior_video_url: resolvedVideo,
    audio_url: resolvedAudio,
  };
  const input = cinemaSpawnInput(resolvedQueue, {
    ...beat,
    video_ref_url: resolvedVideo,
  }).input;

  try {
    const submitted =
      planned.falModelId === "kling3-elements"
        ? await submitKling3Elements(input as unknown as Record<string, unknown>)
        : await submitSeedanceRefToVideo(input as unknown as Record<string, unknown>);
    return { callId: submitted.requestId, recipe: planned.recipe, falModelId: planned.falModelId };
  } catch (err) {
    throw new Error(formatCinemaFalFailure(formatFalError(err, "Cinema fal submit failed")));
  }
}

export async function pollCinemaFal(
  falModelId: "seedance-ref" | "kling3-elements",
  requestId: string,
): Promise<
  | { pending: true; status: "IN_QUEUE" | "IN_PROGRESS" }
  | { done: true; videoUrl: string; contentType?: string }
  | { failed: true; error: string }
> {
  const status = await checkCinemaStatus(falModelId, requestId);
  if (status.status === "IN_QUEUE" || status.status === "IN_PROGRESS") {
    return { pending: true, status: status.status };
  }
  if (status.status === "FAILED") {
    return { failed: true, error: formatCinemaFalFailure(formatFalFailure(status)) };
  }
  try {
    const result = await getVideoResult(falModelId, requestId);
    return { done: true, videoUrl: result.videoUrl, contentType: result.contentType };
  } catch (err) {
    return { failed: true, error: formatCinemaFalFailure(formatFalError(err, "fal.ai video result failed")) };
  }
}
