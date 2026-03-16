import { fal } from "@fal-ai/client";

// Configure fal.ai with API key
fal.config({ credentials: process.env.FAL_KEY });

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
} as const;

export type FalModelId = keyof typeof FAL_MODELS;

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

  const result = await fal.queue.submit(modelConfig.endpointId, { input });
  return { requestId: result.request_id };
}

// ─── Check generation status ─────────────────────────────
export type FalStatus = "IN_QUEUE" | "IN_PROGRESS" | "COMPLETED" | "FAILED";

export async function checkVideoStatus(
  modelId: FalModelId,
  requestId: string,
): Promise<{ status: FalStatus; logs?: string[] }> {
  const modelConfig = FAL_MODELS[modelId];
  const result = await fal.queue.status(modelConfig.endpointId, {
    requestId,
    logs: true,
  });
  return {
    status: result.status as FalStatus,
    logs: (result as { logs?: { message: string }[] }).logs?.map((l) => l.message),
  };
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
  const result = await fal.queue.result(modelConfig.endpointId, { requestId });

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

  throw new Error("No video URL in fal.ai response");
}
