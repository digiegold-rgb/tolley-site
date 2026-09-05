import { fal } from "@fal-ai/client";

// Configure fal.ai with API key
fal.config({ credentials: process.env.FAL_KEY });

/** Pull HTTP status / body / message out of @fal-ai/client errors. */
export function formatFalError(err: unknown, fallback = "fal.ai request failed"): string {
  if (err && typeof err === "object") {
    const rec = err as Record<string, unknown>;
    const status = rec.status ?? rec.statusCode;
    const body = rec.body ?? rec.data;
    const msg = err instanceof Error ? err.message : "";
    let bodyText = "";
    if (typeof body === "string") bodyText = body.slice(0, 500);
    else if (body && typeof body === "object") {
      const bodyRec = body as Record<string, unknown>;
      const nested =
        (typeof bodyRec.detail === "string" && bodyRec.detail) ||
        (typeof bodyRec.message === "string" && bodyRec.message) ||
        (typeof bodyRec.error === "string" && bodyRec.error) ||
        "";
      bodyText = nested || JSON.stringify(body).slice(0, 400);
    }
    const parts = [
      typeof status === "number" ? `HTTP ${status}` : "",
      msg,
      bodyText && bodyText !== msg ? bodyText : "",
    ].filter(Boolean);
    if (parts.length) return parts.join(" — ").slice(0, 2000);
  }
  if (err instanceof Error && err.message.trim()) return err.message.slice(0, 2000);
  if (err != null && String(err).trim()) return String(err).slice(0, 2000);
  return fallback;
}

export function formatFalFailure(status: {
  status?: string;
  error?: string;
  logs?: string[];
}): string {
  const parts = [status.status || "FAILED", status.error, ...(status.logs || []).slice(-4)].filter(
    Boolean,
  );
  return parts.join(" — ").slice(0, 2000) || "fal.ai generation failed";
}

// ─── Model Mapping ───────────────────────────────────────
// Endpoint IDs must be flat (no nested paths) for queue.result to work
export const FAL_MODELS = {
  // Text-to-Video
  "wan26-720p": {
    endpointId: "fal-ai/wan-t2v" as const,
    defaults: { num_frames: 81, enable_safety_checker: false },
  },
  "wan26-1080p": {
    endpointId: "fal-ai/wan-t2v" as const,
    defaults: { num_frames: 129, resolution: "1080p", enable_safety_checker: false },
  },
  "veo3-fast": {
    endpointId: "fal-ai/veo3/fast" as const,
    defaults: {},
  },
  "veo3-standard": {
    endpointId: "fal-ai/veo3" as const,
    defaults: {},
  },
  // Image-to-Video (for real property photos)
  "wan26-i2v-720p": {
    endpointId: "fal-ai/wan-i2v" as const,
    defaults: { num_frames: 81, enable_safety_checker: false },
  },
  "wan26-i2v-1080p": {
    endpointId: "fal-ai/wan-i2v" as const,
    defaults: { num_frames: 81, resolution: "720p", enable_safety_checker: false },
  },
  // First + last frame (optional pose / end still). Flat id — same Wan 2.1 family.
  "wan-flf2v": {
    endpointId: "fal-ai/wan-flf2v" as const,
    defaults: { num_frames: 81, resolution: "720p", enable_safety_checker: false },
  },
} as const;

export type FalModelId = keyof typeof FAL_MODELS;

export const FAL_IMAGE_MODELS = {
  "flux-dev": {
    endpointId: "fal-ai/flux/dev" as const,
    defaults: {
      enable_safety_checker: false,
      num_images: 1,
      output_format: "png",
      num_inference_steps: 28,
    },
  },
} as const;

export type FalImageModelId = keyof typeof FAL_IMAGE_MODELS;

async function submitFalQueue(
  endpointId: string,
  input: Record<string, unknown>,
): Promise<{ requestId: string }> {
  try {
    const result = await fal.queue.submit(endpointId, { input });
    return { requestId: result.request_id };
  } catch (err) {
    throw new Error(formatFalError(err, `fal.ai submit failed (${endpointId})`));
  }
}

// ─── Submit video generation (async queue) ───────────────
export async function submitVideoGeneration(
  modelId: FalModelId,
  prompt: string,
  options?: Record<string, unknown>,
): Promise<{ requestId: string }> {
  const modelConfig = FAL_MODELS[modelId];
  if (!modelConfig) throw new Error(`Unknown model: ${modelId}`);

  const input = {
    prompt,
    ...modelConfig.defaults,
    ...options,
  };

  return submitFalQueue(modelConfig.endpointId, input);
}

export async function submitImageGeneration(
  modelId: FalImageModelId,
  prompt: string,
  options?: Record<string, unknown>,
): Promise<{ requestId: string }> {
  const modelConfig = FAL_IMAGE_MODELS[modelId];
  if (!modelConfig) throw new Error(`Unknown image model: ${modelId}`);

  return submitFalQueue(modelConfig.endpointId, {
    prompt,
    ...modelConfig.defaults,
    ...options,
  });
}

// ─── Check generation status ─────────────────────────────
export type FalStatus = "IN_QUEUE" | "IN_PROGRESS" | "COMPLETED" | "FAILED";

export type FalQueueStatus = {
  status: FalStatus;
  logs?: string[];
  error?: string;
};

async function readQueueStatus(endpointId: string, requestId: string): Promise<FalQueueStatus> {
  try {
    const result = await fal.queue.status(endpointId, { requestId, logs: true });
    const rec = result as {
      status?: string;
      logs?: { message: string }[];
      error?: unknown;
    };
    const error =
      typeof rec.error === "string"
        ? rec.error
        : rec.error != null
          ? JSON.stringify(rec.error).slice(0, 400)
          : undefined;
    return {
      status: (rec.status || "IN_QUEUE") as FalStatus,
      logs: rec.logs?.map((l) => l.message),
      error,
    };
  } catch (err) {
    throw new Error(formatFalError(err, `fal.ai status failed (${endpointId})`));
  }
}

export async function checkVideoStatus(
  modelId: FalModelId,
  requestId: string,
): Promise<FalQueueStatus> {
  const modelConfig = FAL_MODELS[modelId];
  return readQueueStatus(modelConfig.endpointId, requestId);
}

export async function checkImageStatus(
  modelId: FalImageModelId,
  requestId: string,
): Promise<FalQueueStatus> {
  const modelConfig = FAL_IMAGE_MODELS[modelId];
  return readQueueStatus(modelConfig.endpointId, requestId);
}

// ─── Get completed result ────────────────────────────────
export interface FalVideoResult {
  videoUrl: string;
  thumbnailUrl?: string;
  durationSecs?: number;
  contentType?: string;
}

export async function getVideoResult(
  modelId: FalModelId,
  requestId: string,
): Promise<FalVideoResult> {
  const modelConfig = FAL_MODELS[modelId];
  let result: { data?: unknown };
  try {
    result = await fal.queue.result(modelConfig.endpointId, { requestId });
  } catch (err) {
    throw new Error(formatFalError(err, "fal.ai video result failed"));
  }

  // fal.ai returns video in different shapes depending on the model
  const data = result.data as Record<string, unknown>;

  // Wan models return { video: { url, content_type } }
  // Veo models return { video: { url, content_type, duration } }
  const video = data.video as { url?: string; content_type?: string; duration?: number } | undefined;

  if (video?.url) {
    return {
      videoUrl: video.url,
      durationSecs: video.duration,
      contentType: video.content_type,
    };
  }

  // Fallback: check for direct url field
  if (typeof data.url === "string") {
    return { videoUrl: data.url };
  }

  throw new Error(
    `No video URL in fal.ai response (keys: ${Object.keys(data).join(", ") || "none"})`,
  );
}

export interface FalImageResult {
  imageUrl: string;
  contentType?: string;
  seed?: number;
  hasNsfw?: boolean;
}

export async function getImageResult(
  modelId: FalImageModelId,
  requestId: string,
): Promise<FalImageResult> {
  const modelConfig = FAL_IMAGE_MODELS[modelId];
  let result: { data?: unknown };
  try {
    result = await fal.queue.result(modelConfig.endpointId, { requestId });
  } catch (err) {
    throw new Error(formatFalError(err, "fal.ai image result failed"));
  }

  const data = (result.data || {}) as Record<string, unknown>;
  const images = Array.isArray(data.images) ? data.images : [];
  const first = images[0] as { url?: string; content_type?: string } | undefined;
  const nsfwFlags = Array.isArray(data.has_nsfw_concepts) ? data.has_nsfw_concepts : [];
  const hasNsfw = nsfwFlags[0] === true;

  if (!first?.url) {
    throw new Error(
      [
        "fal flux returned no image",
        `keys=${Object.keys(data).join(",") || "none"}`,
        hasNsfw ? "has_nsfw_concepts=true" : "",
      ]
        .filter(Boolean)
        .join(" — "),
    );
  }

  return {
    imageUrl: first.url,
    contentType: first.content_type,
    seed: typeof data.seed === "number" ? data.seed : undefined,
    hasNsfw,
  };
}
